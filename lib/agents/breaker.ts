/**
 * The breaker. Its only job is to kill the strategy. It doubles trading
 * costs, replays the ten worst historical windows for the asset class,
 * shocks slippage, gaps the stops, and halves the book — then reports which
 * stress broke it and how badly. The same stress opts drive the /explore
 * storm, so a crater there is this verdict made spatial.
 */
import { SEGMENTS, dateIndex } from "../fixtures";
import { backtestSummary, runBacktest } from "./backtester";
import { overnight } from "./clock";
import type {
  BacktestOpts,
  BacktestSummary,
  BreakerOutput,
  Strategy,
  StressResult,
} from "./types";

/** Severity of a regime for a gap-fade book — drawdown first, chop close behind. */
const REGIME_PAIN: Record<string, number> = {
  crisis: 3,
  correction: 2,
  chop: 1.2,
  late_cycle: 1,
  recovery: 0.6,
  expansion: 0.3,
};

/** The ten worst historical windows for the asset class, by pain × drawdown. */
export function worstWindows(): Array<{
  regime: (typeof SEGMENTS)[number]["regime"];
  startDate: string;
  endDate: string;
  spyReturn: number;
}> {
  return [...SEGMENTS]
    .sort(
      (a, b) =>
        REGIME_PAIN[b.regime] * -b.spyMaxDrawdown - REGIME_PAIN[a.regime] * -a.spyMaxDrawdown,
    )
    .slice(0, 10)
    .map((s) => ({
      regime: s.regime,
      startDate: s.startDate,
      endDate: s.endDate,
      spyReturn: s.spyReturn,
    }))
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

function windowsAsIndices(): Array<[number, number]> {
  return worstWindows()
    .map(({ startDate, endDate }) => [dateIndex(startDate), dateIndex(endDate)] as [number, number])
    .sort((a, b) => a[0] - b[0]);
}

export interface StressSpec {
  id: string;
  label: string;
  description: string;
  opts: BacktestOpts;
}

/** The stress battery. Exported so /explore can render any of them as terrain. */
export function stressSpecs(): StressSpec[] {
  return [
    {
      id: "costs_x2",
      label: "Costs doubled",
      description: "Every commission and every slip, twice over. The toll booth scenario.",
      opts: { costMultiplier: 2 },
    },
    {
      id: "slippage_shock",
      label: "Slippage shock",
      description: "+150bps on every fill — the book trades like the exit is crowded.",
      opts: { extraSlippageBps: 150 },
    },
    {
      id: "stop_gap",
      label: "Stops gap through",
      description: "Stop fills land 250bps through the level. Overnight risk priced honestly.",
      opts: { stopGapBps: 250 },
    },
    {
      id: "worst_regimes",
      label: "Ten worst windows",
      description:
        "The strategy only ever trades inside the ten ugliest stretches of the last five years.",
      opts: { windows: windowsAsIndices() },
    },
    {
      id: "half_book",
      label: "Liquidity halves",
      description: "Half the slots vanish — the fills you assumed simply aren't there.",
      opts: { maxConcurrentOverride: 2, extraSlippageBps: 60 },
    },
  ];
}

/** The composite the storm renders: worst windows with doubled costs. */
export const STORM_OPTS: BacktestOpts = {
  costMultiplier: 2,
  extraSlippageBps: 60,
  windows: windowsAsIndices(),
};

function severityOf(base: BacktestSummary, stressed: BacktestSummary): number {
  const cagrLoss =
    base.cagr > 0 ? Math.max(0, (base.cagr - stressed.cagr) / base.cagr) : stressed.cagr < 0 ? 1 : 0;
  const ddGrowth =
    base.maxDrawdown < 0
      ? Math.max(0, stressed.maxDrawdown / base.maxDrawdown - 1)
      : stressed.maxDrawdown < 0
        ? 1
        : 0;
  return Math.min(1, 0.7 * Math.min(cagrLoss, 1.5) + 0.3 * Math.min(ddGrowth, 2));
}

let cached: BreakerOutput | null = null;

export function runBreaker(strategy: Strategy): BreakerOutput {
  if (cached && cached.strategyId === strategy.id) return cached;

  const base = backtestSummary(strategy);
  const stresses: StressResult[] = stressSpecs().map((spec) => {
    const stressed = backtestSummary(strategy, spec.opts);
    const broke = stressed.cagr <= 0 || stressed.maxDrawdown <= 2 * base.maxDrawdown;
    return {
      id: spec.id,
      label: spec.label,
      description: spec.description,
      opts: spec.opts,
      base,
      stressed,
      cagrDelta: round6(stressed.cagr - base.cagr),
      ddDelta: round6(stressed.maxDrawdown - base.maxDrawdown),
      broke,
      severity: round4(severityOf(base, stressed)),
    };
  });

  const killer = [...stresses].sort((a, b) => b.severity - a.severity)[0];
  const survived = stresses.filter((s) => !s.broke).length;

  const verdict = killer.broke
    ? `${killer.label} kills it: CAGR ${pct(base.cagr)} → ${pct(killer.stressed.cagr)}, ` +
      `max drawdown ${pct(base.maxDrawdown)} → ${pct(killer.stressed.maxDrawdown)}. ` +
      `${survived} of ${stresses.length} stresses survived — the edge is real but it is thin, ` +
      `and it lives inside the fill quality.`
    : `Bent, not broken: worst stress (${killer.label}) leaves CAGR at ${pct(
        killer.stressed.cagr,
      )}. The strategy survives the battery, but ${pct(-killer.cagrDelta)} of annual edge ` +
      `evaporates under stress — size accordingly.`;

  // The context series: equity through the killer stress, day by day.
  const stressedRun = runBacktest(strategy, killer.opts);

  cached = {
    agent: "breaker",
    timestamp: overnight(204), // 03:24 — after the backtester's clean run
    asset: "STRATEGY",
    horizon: "cycle",
    trend_context: stressedRun.equity,
    strategyId: strategy.id,
    stresses,
    killer,
    verdict,
    worstWindows: worstWindows(),
  };
  return cached;
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}
function round4(x: number): number {
  return Math.round(x * 1e4) / 1e4;
}
function round6(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}
