/**
 * The coder. Takes one plain-English sentence and compiles it into a strategy
 * object the backtester can execute. The interesting part is the debug loop:
 * three drafts, each run for real, each annotated with what broke and what the
 * next draft fixed. The numbers in the previews come from actual replays, not
 * copy.
 */
import { backtestSummary } from "./backtester";
import { overnight } from "./clock";
import type { CoderOutput, Strategy, StrategyDraft } from "./types";

export const SENTENCE =
  "Fade the gap in small-cap biotech after FDA calendar events.";

/** Draft 1 — the literal compilation. No stop, no cost model, whole book per slot. */
const draft1: Strategy = {
  id: "fade-fda-v1",
  name: "FDA gap fade · draft 1",
  sentence: SENTENCE,
  filter: { sectors: ["Biotech"], caps: ["small"] },
  trigger: { kind: "fda" },
  entry: { style: "fade", minGap: 0.03 },
  exit: { holdingDays: 5, stopPct: null },
  sizing: { scheme: "equal_slot", grossTargetPct: 100, maxConcurrent: 1 },
  costs: { perSideBps: 0, slippageBps: 0 },
};

/** Draft 2 — costs and a stop. But the stop is tighter than the product's vol. */
const draft2: Strategy = {
  ...draft1,
  id: "fade-fda-v2",
  name: "FDA gap fade · draft 2",
  exit: { holdingDays: 5, stopPct: 0.08 },
  sizing: { scheme: "equal_slot", grossTargetPct: 100, maxConcurrent: 2 },
  costs: { perSideBps: 5, slippageBps: 20 },
};

/**
 * Draft 3 — the keeper. Trades the ridge: gaps between 5% and 12%, a stop
 * sized to the product's volatility, four slots at a fifth of gross each.
 */
const draft3: Strategy = {
  ...draft2,
  id: "fade-fda-v3",
  name: "FDA gap fade",
  entry: { style: "fade", minGap: 0.05, maxGap: 0.12 },
  exit: { holdingDays: 5, stopPct: 0.14 },
  sizing: { scheme: "equal_slot", grossTargetPct: 80, maxConcurrent: 4 },
};

export const STRATEGY: Strategy = draft3;

let cached: CoderOutput | null = null;

export function runCoder(): CoderOutput {
  if (cached) return cached;

  const previews = [draft1, draft2, draft3].map((s) => {
    const sum = backtestSummary(s);
    return {
      cagr: sum.cagr,
      maxDrawdown: sum.maxDrawdown,
      sharpe: sum.sharpe,
      trades: sum.trades,
    };
  });

  const drafts: StrategyDraft[] = [
    {
      version: 1,
      strategy: draft1,
      broke:
        "Backtest looked heroic until the trade log did: zero costs, no stop, and one slot carrying 100% gross — a single adverse readout marks the whole book. Frictionless fills on 10%-gap biotech opens are fiction.",
      fixed: null,
      preview: previews[0],
    },
    {
      version: 2,
      strategy: draft2,
      broke:
        "Two new problems, both self-inflicted. The 8% stop is tighter than a small-cap biotech's daily range — it converts noise into realized losses and kicks the book out of trades that were about to revert. And sorting entries by gap size fades the very largest gaps, which are the one place the edge doesn't exist: a 15% readout gap is information, not noise.",
      fixed:
        "Priced the fills: 5bps commission, 20bps slippage per side. Added a stop and a second slot.",
      preview: previews[1],
    },
    {
      version: 3,
      strategy: draft3,
      broke: null,
      fixed:
        "Trades only the ridge: gaps between 5% and 12% — big enough to overreact, not big enough to be a verdict. Stop widened to 14% so it fits the product's volatility instead of fighting it. Four slots at a fifth of gross each so one readout can't mark the book.",
      preview: previews[2],
    },
  ];

  cached = {
    agent: "coder",
    timestamp: overnight(136), // 02:16 — third draft accepted, handed to the backtester
    asset: "STRATEGY",
    horizon: "cycle",
    // The debug loop as a series: risk-adjusted quality per compile attempt.
    trend_context: drafts.map((d) => ({
      date: overnight(124 + d.version * 4), // 02:08, 02:12, 02:16
      value: d.preview.sharpe,
    })),
    sentence: SENTENCE,
    drafts,
    final: draft3,
  };
  return cached;
}
