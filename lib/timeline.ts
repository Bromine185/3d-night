/**
 * The shared timeline: every event across five years and every agent finding
 * from last night, as dots on one time axis. The strip at the top of the
 * dashboard renders this; clicking a dot scrolls to the section that owns it.
 */
import { EVENTS, SEGMENTS } from "./fixtures";
import type { RegimeId } from "./fixtures/types";
import { RUN_DATE } from "./agents/clock";
import { STRATEGY, personasSummary, runBacktest, runBreaker, runCoder, runCritic, runPersonas } from "./agents";

export type TimelineKind = "market" | "personas" | "coder" | "backtester" | "breaker" | "critic";

export interface TimelineDot {
  /** Epoch milliseconds. */
  t: number;
  kind: TimelineKind;
  /** Dashboard section anchor the dot belongs to. */
  section: "overnight" | "lab" | "stress" | "mirror";
  headline: string;
  symbol?: string;
}

/** Market events trade at the open — 09:30 New York. */
function openMs(isoDate: string): number {
  return Date.parse(`${isoDate}T09:30:00-04:00`);
}

/** The strip's "now": the morning after the overnight run. */
export const NOW_MS = Date.parse(`${RUN_DATE}T08:00:00-04:00`);

export const ZOOMS = [
  { id: "8h", label: "8H", ms: 8 * 3600_000 },
  { id: "1w", label: "1W", ms: 7 * 86_400_000 },
  { id: "1m", label: "1M", ms: 31 * 86_400_000 },
  { id: "1q", label: "1Q", ms: 92 * 86_400_000 },
  { id: "1y", label: "1Y", ms: 366 * 86_400_000 },
  { id: "2y", label: "2Y", ms: 2 * 366 * 86_400_000 },
] as const;

export type ZoomId = (typeof ZOOMS)[number]["id"];

let cache: TimelineDot[] | null = null;

export function buildTimeline(): TimelineDot[] {
  if (cache) return cache;

  const dots: TimelineDot[] = [];

  for (const e of EVENTS) {
    dots.push({
      t: openMs(e.date),
      kind: "market",
      section: "overnight",
      headline: e.headline,
      symbol: e.symbol,
    });
  }

  for (const v of runPersonas()) {
    dots.push({
      t: Date.parse(v.timestamp),
      kind: "personas",
      section: "overnight",
      headline: `${v.name} · ${v.asset} ${v.direction > 0 ? "long" : v.direction < 0 ? "short" : "flat"}`,
      symbol: v.asset,
    });
  }
  const s = personasSummary();
  dots.push({
    t: Date.parse(s.timestamp),
    kind: "personas",
    section: "overnight",
    headline: `Fifty in: dispersion ${s.dispersion.toFixed(2)}${s.fractured ? " — fractured" : ""}`,
  });

  const coder = runCoder();
  for (const d of coder.drafts) {
    dots.push({
      t: Date.parse(coder.trend_context[d.version - 1].date),
      kind: "coder",
      section: "lab",
      headline: `Coder draft ${d.version}${d.broke ? " — broke" : " — accepted"}`,
    });
  }

  const bt = runBacktest(STRATEGY);
  dots.push({
    t: Date.parse(bt.timestamp),
    kind: "backtester",
    section: "lab",
    headline: `Five years replayed in ${(bt.elapsedMs / 1000).toFixed(0)}s — ${bt.summary.trades} trades`,
  });

  const br = runBreaker(STRATEGY);
  dots.push({
    t: Date.parse(br.timestamp),
    kind: "breaker",
    section: "stress",
    headline: `Stress battery: ${br.stresses.filter((x) => !x.broke).length} of ${br.stresses.length} survived`,
  });

  const cr = runCritic();
  dots.push({
    t: Date.parse(cr.timestamp),
    kind: "critic",
    section: "mirror",
    headline: `Critic: ${cr.pattern.toLowerCase()}`,
  });

  dots.sort((a, b) => a.t - b.t);
  cache = dots;
  return dots;
}

export interface RegimeSpan {
  regime: RegimeId;
  startMs: number;
  endMs: number;
}

/** Regime bands for the strip's context ribbon. */
export function regimeSpans(): RegimeSpan[] {
  return SEGMENTS.map((s) => ({
    regime: s.regime,
    startMs: openMs(s.startDate),
    endMs: openMs(s.endDate) + 6.5 * 3600_000,
  }));
}
