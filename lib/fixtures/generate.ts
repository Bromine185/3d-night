import { tradingDays } from "./calendar";
import { Rng, FIXTURE_SEED } from "./rng";
import { REGIME_ORDER, TRANSITIONS, regimeDefs } from "./regimes";
import {
  ASSETS,
  EQUITIES,
  FACTOR_SECTORS,
  SECTOR_REGIME_DRIFT,
  SECTOR_VOL,
  type FactorSector,
} from "./universe";
// SECTOR_VOL is used both for the sector factors and for sizing earnings gaps.
import type {
  Asset,
  BarSeries,
  BarsFile,
  EventKind,
  EventsFile,
  FixtureMeta,
  MarketEvent,
  MarketFile,
  RegimeId,
  RegimeSegment,
  UniverseFile,
} from "./types";

export const START_DATE = "2021-08-16";
export const END_DATE = "2026-08-14";
const GENERATOR = "lib/fixtures/generate.ts@1";

const SQRT252 = Math.sqrt(252);

/** Regime paths that fail these are resampled, so the demo always has texture. */
const PATH_REQUIREMENTS = {
  minSegments: 12,
  minCrisisSegments: 1,
  minCorrectionSegments: 2,
  minRecoverySegments: 1,
  minCrisisDays: 25,
  maxExpansionShare: 0.55,
  minExpansionShare: 0.22,
};

function round(x: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

// ---------------------------------------------------------------------------
// Regime path
// ---------------------------------------------------------------------------

function samplePath(rng: Rng, n: number): RegimeId[] {
  const path: RegimeId[] = [];
  let current: RegimeId = "expansion";
  for (let i = 0; i < n; i++) {
    path.push(current);
    current = REGIME_ORDER[rng.categorical(TRANSITIONS[current])];
  }
  return path;
}

function pathIsUsable(path: RegimeId[]): boolean {
  const counts = new Map<RegimeId, number>();
  let segments = 0;
  for (let i = 0; i < path.length; i++) {
    counts.set(path[i], (counts.get(path[i]) ?? 0) + 1);
    if (i === 0 || path[i] !== path[i - 1]) segments++;
  }
  const segmentsOf = (id: RegimeId) => {
    let s = 0;
    for (let i = 0; i < path.length; i++) {
      if (path[i] === id && (i === 0 || path[i - 1] !== id)) s++;
    }
    return s;
  };
  const expansionShare = (counts.get("expansion") ?? 0) / path.length;
  return (
    segments >= PATH_REQUIREMENTS.minSegments &&
    segmentsOf("crisis") >= PATH_REQUIREMENTS.minCrisisSegments &&
    segmentsOf("correction") >= PATH_REQUIREMENTS.minCorrectionSegments &&
    segmentsOf("recovery") >= PATH_REQUIREMENTS.minRecoverySegments &&
    (counts.get("crisis") ?? 0) >= PATH_REQUIREMENTS.minCrisisDays &&
    expansionShare <= PATH_REQUIREMENTS.maxExpansionShare &&
    expansionShare >= PATH_REQUIREMENTS.minExpansionShare
  );
}

/** Deterministic: attempts are numbered, so the accepted path is always the same. */
function regimePath(root: Rng, n: number): { path: RegimeId[]; attempts: number } {
  for (let attempt = 0; attempt < 2000; attempt++) {
    const path = samplePath(root.fork(`regime-path/${attempt}`), n);
    if (pathIsUsable(path)) return { path, attempts: attempt + 1 };
  }
  throw new Error("no regime path satisfied PATH_REQUIREMENTS in 2000 attempts");
}

// ---------------------------------------------------------------------------
// Factors
// ---------------------------------------------------------------------------

interface Factors {
  marketReturn: number[];
  /** AR(1) log volatility multiplier, shared by market, sectors and VIX. */
  volMult: number[];
  vix: number[];
  sector: Record<FactorSector, number[]>;
}

function simulateFactors(root: Rng, path: RegimeId[]): Factors {
  const defs = Object.fromEntries(regimeDefs().map((d) => [d.id, d])) as Record<
    RegimeId,
    ReturnType<typeof regimeDefs>[number]
  >;

  const mRng = root.fork("factor/market");
  const vRng = root.fork("factor/vol-cluster");
  const xRng = root.fork("factor/vix");

  const n = path.length;
  const marketReturn = new Array<number>(n);
  const volMult = new Array<number>(n);
  const vix = new Array<number>(n);

  let logVol = 0;
  let logVix = Math.log(16.5);

  for (let i = 0; i < n; i++) {
    const def = defs[path[i]];

    // Volatility clustering: quiet days follow quiet days regardless of regime.
    logVol = 0.94 * logVol + 0.055 * vRng.normal();
    logVol = Math.max(-0.6, Math.min(0.85, logVol));
    const mult = Math.exp(logVol);
    volMult[i] = mult;

    const sigma = (def.vol / SQRT252) * mult;
    let r = def.drift / 252 + sigma * mRng.normal();

    if (mRng.bool(def.shockProb)) {
      const upsideProb = path[i] === "recovery" ? 0.55 : 0.25;
      const sign = mRng.bool(upsideProb) ? 1 : -1;
      r += sign * Math.abs(mRng.studentT(3)) * sigma * 1.9;
    }
    r = Math.max(-0.13, Math.min(0.11, r));
    marketReturn[i] = r;

    // VIX: mean-reverts to the regime target, spikes against the tape.
    const target = Math.log(def.vixTarget * Math.pow(mult, 0.6));
    logVix += 0.12 * (target - logVix) - 4.4 * r + 0.055 * xRng.normal();
    logVix = Math.max(Math.log(9.2), Math.min(Math.log(95), logVix));
    vix[i] = Math.exp(logVix);
  }

  const sector = {} as Record<FactorSector, number[]>;
  for (const s of FACTOR_SECTORS) {
    const sRng = root.fork(`factor/sector/${s}`);
    const series = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      const drift = SECTOR_REGIME_DRIFT[s][path[i]] / 252;
      const sigma = (SECTOR_VOL[s] / SQRT252) * Math.pow(volMult[i], 0.8);
      // Ito correction, so the drift constant means the *realised* sector drift.
      series[i] = drift - 0.5 * sigma * sigma + sigma * sRng.normal();
    }
    sector[s] = series;
  }

  return { marketReturn, volMult, vix, sector };
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

const FDA_HEADLINES = [
  "Phase 3 readout in %s",
  "FDA advisory committee vote on %s",
  "PDUFA decision date for %s",
  "Clinical hold lifted on %s programme",
  "Interim efficacy data from %s trial",
  "Complete response letter on %s filing",
];

const GUIDANCE_HEADLINES = [
  "Guidance revised at %s",
  "Investor day resets targets at %s",
  "Segment margin pre-announcement from %s",
];

const MA_HEADLINES = [
  "Press report links %s to a strategic review",
  "Activist stake disclosed in %s",
  "Takeout speculation lifts %s",
];

function fill(template: string, subject: string): string {
  return template.replace("%s", subject);
}

function scheduleEvents(
  root: Rng,
  dates: string[],
  path: RegimeId[],
  marketReturn: number[],
): MarketEvent[] {
  const events: MarketEvent[] = [];
  const n = dates.length;

  for (const asset of EQUITIES) {
    const rng = root.fork(`events/${asset.symbol}`);
    // Earnings gaps scale with the name's *total* vol, not just its residual.
    const totalVol = Math.sqrt(
      (asset.beta * 0.18) ** 2 +
        (asset.sectorLoading * (SECTOR_VOL[asset.sector as FactorSector] ?? 0)) ** 2 +
        asset.idioVol ** 2,
    );

    if (asset.earningsCadence > 0) {
      const scale = Math.max(0.012, Math.min(0.075, (totalVol / SQRT252) * 3));
      const phase = rng.int(0, asset.earningsCadence);
      for (let i = phase; i < n; i += asset.earningsCadence) {
        const gap = Math.max(-0.28, Math.min(0.28, scale * rng.studentT(4)));
        events.push({
          date: dates[i],
          symbol: asset.symbol,
          kind: "earnings",
          gap: round(gap, 5),
          regime: path[i],
          headline: `${asset.name} reports quarterly results`,
        });
      }
    }

    if (asset.catalystCadence > 0 && asset.catalystGapScale > 0) {
      let i = rng.int(0, asset.catalystCadence);
      while (i < n) {
        const gap = Math.max(-0.55, Math.min(0.55, asset.catalystGapScale * rng.studentT(3)));
        const kind: EventKind =
          asset.sector === "Biotech" || asset.sector === "Healthcare"
            ? rng.bool(0.85)
              ? "fda"
              : "ma_rumor"
            : rng.bool(0.6)
              ? "guidance"
              : "ma_rumor";
        const templates =
          kind === "fda"
            ? FDA_HEADLINES
            : kind === "guidance"
              ? GUIDANCE_HEADLINES
              : MA_HEADLINES;
        events.push({
          date: dates[i],
          symbol: asset.symbol,
          kind,
          gap: round(gap, 5),
          regime: path[i],
          headline: fill(rng.pick(templates), asset.name),
        });
        i += Math.round(asset.catalystCadence * rng.uniform(0.55, 1.45));
      }
    }
  }

  // Macro prints: every regime handoff, plus the twenty sharpest market days.
  const macroRng = root.fork("events/macro");
  for (let i = 1; i < n; i++) {
    if (path[i] === path[i - 1]) continue;
    events.push({
      date: dates[i],
      symbol: "SPY",
      kind: "macro",
      gap: 0,
      regime: path[i],
      headline: `Regime handoff — ${path[i - 1].replace("_", " ")} to ${path[i].replace("_", " ")}`,
    });
  }
  const sharpest = marketReturn
    .map((r, i) => ({ r, i }))
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
    .slice(0, 20);
  for (const { r, i } of sharpest) {
    const label = macroRng.pick([
      "CPI print",
      "FOMC decision",
      "payrolls",
      "PPI revision",
      "Treasury refunding",
    ]);
    events.push({
      date: dates[i],
      symbol: "SPY",
      kind: "macro",
      gap: round(r, 5),
      regime: path[i],
      headline: `${label} moves the tape ${r >= 0 ? "+" : ""}${(r * 100).toFixed(1)}%`,
    });
  }

  events.sort((a, b) =>
    a.date === b.date ? a.symbol.localeCompare(b.symbol) : a.date.localeCompare(b.date),
  );
  return events;
}

// ---------------------------------------------------------------------------
// Bars
// ---------------------------------------------------------------------------

function emptySeries(n: number): BarSeries {
  return {
    o: new Array<number>(n),
    h: new Array<number>(n),
    l: new Array<number>(n),
    c: new Array<number>(n),
    v: new Array<number>(n),
  };
}

function simulateEquity(
  root: Rng,
  asset: Asset,
  dates: string[],
  path: RegimeId[],
  factors: Factors,
  gapsByDate: Map<string, number>,
  earningsDates: Set<string>,
): BarSeries {
  const rng = root.fork(`bars/${asset.symbol}`);
  const n = dates.length;
  const s = emptySeries(n);
  const sectorSeries =
    asset.sector in factors.sector
      ? factors.sector[asset.sector as FactorSector]
      : null;

  let prevClose = asset.startPrice;

  for (let i = 0; i < n; i++) {
    const mult = factors.volMult[i];
    // Residual return is pure noise: the Ito term keeps it from drifting.
    const idioSigma = (asset.idioVol / SQRT252) * Math.pow(mult, 0.9);
    const idio = idioSigma * rng.normal() - 0.5 * idioSigma * idioSigma;
    const sectorTerm = sectorSeries ? asset.sectorLoading * sectorSeries[i] : 0;
    const gap = gapsByDate.get(dates[i]) ?? 0;

    let r = asset.alpha / 252 + asset.beta * factors.marketReturn[i] + sectorTerm + idio;
    r = Math.max(-0.35, Math.min(0.4, r));

    const totalReturn = (1 + r) * (1 + gap) - 1;
    const close = Math.max(0.75, prevClose * (1 + totalReturn));

    // Split the move into an overnight gap and an intraday drift.
    const overnight = gap + 0.32 * r + 0.0016 * rng.normal();
    const open = Math.max(0.6, prevClose * (1 + overnight));

    const body = Math.abs(close / open - 1);
    const rangeScale = (asset.idioVol / SQRT252) * Math.pow(mult, 0.9) * 1.35 + body * 0.5;
    const high = Math.max(open, close) * (1 + rng.uniform(0.06, 1) * rangeScale);
    const low = Math.min(open, close) * (1 - rng.uniform(0.06, 1) * rangeScale);

    const activity =
      Math.exp(0.26 * rng.normal()) *
      (1 + 2.4 * Math.min(3, Math.abs(totalReturn) / (asset.idioVol / SQRT252 + 1e-6)) * 0.28) *
      (earningsDates.has(dates[i]) ? rng.uniform(2.4, 4.6) : 1) *
      (gap !== 0 ? rng.uniform(1.8, 3.4) : 1);

    s.o[i] = round(open, 2);
    s.h[i] = round(Math.max(high, open, close), 2);
    s.l[i] = round(Math.min(low, open, close), 2);
    s.c[i] = round(close, 2);
    s.v[i] = Math.round(asset.baseVolume * activity);

    prevClose = close;
  }

  return s;
}

function simulateVix(root: Rng, vix: number[]): BarSeries {
  const rng = root.fork("bars/VIX");
  const n = vix.length;
  const s = emptySeries(n);
  for (let i = 0; i < n; i++) {
    const close = vix[i];
    const prev = i === 0 ? vix[0] : vix[i - 1];
    const open = Math.max(9.1, prev * (1 + 0.25 * (close / prev - 1) + 0.014 * rng.normal()));
    const span = close * rng.uniform(0.02, 0.11);
    s.o[i] = round(open, 2);
    s.h[i] = round(Math.max(open, close) + span, 2);
    s.l[i] = round(Math.max(8.9, Math.min(open, close) - span * 0.7), 2);
    s.c[i] = round(close, 2);
    s.v[i] = 0;
  }
  return s;
}

// ---------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------

function buildSegments(
  dates: string[],
  path: RegimeId[],
  spyClose: number[],
  vix: number[],
): RegimeSegment[] {
  const segments: RegimeSegment[] = [];
  let start = 0;

  const flush = (end: number) => {
    let peak = spyClose[start];
    let maxDd = 0;
    let vixSum = 0;
    for (let i = start; i <= end; i++) {
      peak = Math.max(peak, spyClose[i]);
      maxDd = Math.min(maxDd, spyClose[i] / peak - 1);
      vixSum += vix[i];
    }
    segments.push({
      regime: path[start],
      startDate: dates[start],
      endDate: dates[end],
      days: end - start + 1,
      spyReturn: round(spyClose[end] / spyClose[start] - 1, 4),
      spyMaxDrawdown: round(maxDd, 4),
      meanVix: round(vixSum / (end - start + 1), 2),
    });
  };

  for (let i = 1; i < path.length; i++) {
    if (path[i] !== path[i - 1]) {
      flush(i - 1);
      start = i;
    }
  }
  flush(path.length - 1);
  return segments;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export interface GeneratedFixtures {
  universe: UniverseFile;
  bars: BarsFile;
  market: MarketFile;
  events: EventsFile;
  stats: {
    regimePathAttempts: number;
    eventCount: number;
    barCount: number;
  };
}

export function generateFixtures(seed = FIXTURE_SEED): GeneratedFixtures {
  const root = new Rng(seed);
  const dates = tradingDays(START_DATE, END_DATE);
  const n = dates.length;

  const meta: FixtureMeta = {
    seed,
    generator: GENERATOR,
    startDate: dates[0],
    endDate: dates[n - 1],
    tradingDays: n,
    synthetic: true,
  };

  const { path, attempts } = regimePath(root, n);
  const factors = simulateFactors(root, path);
  const events = scheduleEvents(root, dates, path, factors.marketReturn);

  // Index events per symbol so the bar loop can apply gaps in one pass.
  const gapsBySymbol = new Map<string, Map<string, number>>();
  const earningsBySymbol = new Map<string, Set<string>>();
  for (const e of events) {
    if (e.kind === "macro") continue;
    if (!gapsBySymbol.has(e.symbol)) gapsBySymbol.set(e.symbol, new Map());
    const m = gapsBySymbol.get(e.symbol)!;
    m.set(e.date, (m.get(e.date) ?? 0) + e.gap);
    if (e.kind === "earnings") {
      if (!earningsBySymbol.has(e.symbol)) earningsBySymbol.set(e.symbol, new Set());
      earningsBySymbol.get(e.symbol)!.add(e.date);
    }
  }

  const series: Record<string, BarSeries> = {};
  for (const asset of ASSETS) {
    series[asset.symbol] =
      asset.symbol === "VIX"
        ? simulateVix(root, factors.vix)
        : simulateEquity(
            root,
            asset,
            dates,
            path,
            factors,
            gapsBySymbol.get(asset.symbol) ?? new Map(),
            earningsBySymbol.get(asset.symbol) ?? new Set(),
          );
  }

  const segments = buildSegments(dates, path, series.SPY.c, factors.vix);

  return {
    universe: { meta, assets: ASSETS },
    bars: { meta, dates, series },
    market: {
      meta,
      dates,
      regimes: regimeDefs(),
      regimeByDay: path,
      marketReturn: factors.marketReturn.map((r) => round(r, 6)),
      vix: factors.vix.map((v) => round(v, 2)),
      segments,
    },
    events: { meta, events },
    stats: {
      regimePathAttempts: attempts,
      eventCount: events.length,
      barCount: n * ASSETS.length,
    },
  };
}
