/**
 * Writes lib/fixtures/data/*.json from the seeded model.
 *
 *   pnpm fixtures
 *
 * The app never runs this — it imports the committed JSON. Re-run it only when
 * the model changes, and commit the diff.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { generateFixtures } from "../lib/fixtures/generate";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "lib", "fixtures", "data");

const { universe, bars, market, events, stats } = generateFixtures();

mkdirSync(outDir, { recursive: true });

const files: Array<[string, unknown]> = [
  ["universe.json", universe],
  ["bars.json", bars],
  ["market.json", market],
  ["events.json", events],
];

const hash = createHash("sha256");
for (const [name, payload] of files) {
  const json = JSON.stringify(payload);
  writeFileSync(join(outDir, name), `${json}\n`);
  hash.update(json);
  const kb = (Buffer.byteLength(json) / 1024).toFixed(0);
  console.log(`  ${name.padEnd(14)} ${kb.padStart(6)} kB`);
}

const segments = market.segments;
const byRegime = new Map<string, number>();
for (const s of segments) byRegime.set(s.regime, (byRegime.get(s.regime) ?? 0) + s.days);

const spy = bars.series.SPY.c;
console.log("");
console.log(`  seed              ${universe.meta.seed}`);
console.log(`  window            ${universe.meta.startDate} → ${universe.meta.endDate}`);
console.log(`  trading days      ${universe.meta.tradingDays}`);
console.log(`  assets            ${universe.assets.length}`);
console.log(`  bars              ${stats.barCount}`);
console.log(`  events            ${stats.eventCount}`);
console.log(`  regime path       accepted on attempt ${stats.regimePathAttempts}`);
console.log(`  segments          ${segments.length}`);
for (const [regime, days] of [...byRegime].sort((a, b) => b[1] - a[1])) {
  const share = ((days / universe.meta.tradingDays) * 100).toFixed(1);
  console.log(`    ${regime.padEnd(12)} ${String(days).padStart(4)} d  ${share.padStart(5)}%`);
}
console.log(
  `  SPY               ${spy[0].toFixed(2)} → ${spy[spy.length - 1].toFixed(2)}  (${(
    (spy[spy.length - 1] / spy[0] - 1) * 100
  ).toFixed(1)}%)`,
);
console.log(`  VIX               ${Math.min(...market.vix)} – ${Math.max(...market.vix)}`);
console.log(`  checksum          ${hash.digest("hex").slice(0, 16)}`);
