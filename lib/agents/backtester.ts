/**
 * The backtester. Replays five years of bars against a strategy object and
 * emits an equity curve, drawdown series, trade log, and regime-tagged
 * performance. Daily-bar resolution: entries at the open, stops checked
 * against the day's extremes, time exits at the open. Costs are charged per
 * round trip as bps of notional.
 *
 * `computeSurface` runs the same engine over a grid of (entry threshold ×
 * holding period) — that grid is the /explore terrain.
 */
import {
  ASSETS,
  DATES,
  EVENTS,
  REGIME_BY_DAY,
  dateIndex,
  getSeries,
} from "../fixtures";
import type { MarketEvent } from "../fixtures/types";
import { overnight } from "./clock";
import type {
  BacktestOpts,
  BacktestResult,
  BacktestSummary,
  RegimeStat,
  Strategy,
  Surface,
  Trade,
  TrendPoint,
} from "./types";

const TRADING_DAYS_PER_YEAR = 252;

interface Position {
  symbol: string;
  direction: 1 | -1;
  entryIdx: number;
  entryPx: number;
  exitIdx: number; // scheduled time exit
  gap: number;
  lastPx: number; // last mark — yesterday's close, or the entry fill today
}

/** Events that can trigger the strategy, in date order. */
export function candidateEvents(strategy: Strategy): MarketEvent[] {
  const { filter, trigger } = strategy;
  const bySymbol = new Map(ASSETS.map((a) => [a.symbol, a]));
  return EVENTS.filter((e) => {
    if (e.kind !== trigger.kind) return false;
    const asset = bySymbol.get(e.symbol);
    if (!asset) return false;
    if (filter.sectors && !filter.sectors.includes(asset.sector)) return false;
    if (filter.caps && !filter.caps.includes(asset.cap)) return false;
    if (filter.symbols && !filter.symbols.includes(e.symbol)) return false;
    return true;
  }).sort((a, b) => dateIndex(a.date) - dateIndex(b.date) || a.symbol.localeCompare(b.symbol));
}

interface EngineOutput {
  equityByDay: Float64Array; // aligned to dayIndices
  dayIndices: number[]; // global date indices actually replayed
  trades: Trade[];
  exposedDays: number;
}

function replay(strategy: Strategy, events: MarketEvent[], opts: BacktestOpts): EngineOutput {
  const costMult = opts.costMultiplier ?? 1;
  const perSide =
    ((strategy.costs.perSideBps + strategy.costs.slippageBps) * costMult +
      (opts.extraSlippageBps ?? 0)) /
    10_000;
  const roundTrip = 2 * perSide;
  const stopGap = (opts.stopGapBps ?? 0) / 10_000;
  const maxConcurrent = opts.maxConcurrentOverride ?? strategy.sizing.maxConcurrent;
  // Per-slot weight stays anchored to the strategy's own book, so halving the
  // slots (a breaker stress) shrinks gross instead of concentrating it.
  const weight = strategy.sizing.grossTargetPct / 100 / strategy.sizing.maxConcurrent;
  const { holdingDays, stopPct } = strategy.exit;

  const end = Math.min(opts.endIndex ?? DATES.length - 1, DATES.length - 1);
  const windows: Array<[number, number]> = (
    opts.windows?.map(([a, b]) => [Math.max(0, a), Math.min(b, end)] as [number, number]) ?? [
      [0, end],
    ]
  ).filter(([a, b]) => a <= b);
  const dayIndices: number[] = [];
  for (const [a, b] of windows) for (let i = a; i <= b; i++) dayIndices.push(i);

  const inWindow = new Set(dayIndices);
  const eventsByDay = new Map<number, MarketEvent[]>();
  for (const e of events) {
    const i = dateIndex(e.date);
    if (!inWindow.has(i)) continue;
    if (Math.abs(e.gap) < strategy.entry.minGap) continue;
    if (strategy.entry.maxGap !== undefined && Math.abs(e.gap) > strategy.entry.maxGap) continue;
    const list = eventsByDay.get(i) ?? [];
    list.push(e);
    eventsByDay.set(i, list);
  }

  const series = new Map(ASSETS.map((a) => [a.symbol, getSeries(a.symbol)]));
  const equityByDay = new Float64Array(dayIndices.length);
  const trades: Trade[] = [];
  let open: Position[] = [];
  let equity = 1;
  let exposedDays = 0;

  const logTrade = (
    p: Position,
    exitPx: number,
    dayIdx: number,
    reason: Trade["exitReason"],
  ): void => {
    trades.push({
      symbol: p.symbol,
      entryDate: DATES[p.entryIdx],
      exitDate: DATES[dayIdx],
      direction: p.direction,
      entryPx: round4(p.entryPx),
      exitPx: round4(exitPx),
      gapAtEntry: p.gap,
      ret: round6(p.direction * (exitPx / p.entryPx - 1) - roundTrip),
      regime: REGIME_BY_DAY[p.entryIdx],
      holdingDays: dayIdx - p.entryIdx,
      exitReason: reason,
    });
  };

  for (let d = 0; d < dayIndices.length; d++) {
    const i = dayIndices[d];
    // A boundary is the last replayed day before the date axis jumps (stress
    // windows) or the end of the replay. Nothing holds across a boundary.
    const isBoundary = d === dayIndices.length - 1 || dayIndices[d + 1] !== i + 1;
    let dayPnl = 0;

    // 1 — scheduled time exits at today's open, freeing slots before entries.
    const held: Position[] = [];
    for (const p of open) {
      if (i >= p.exitIdx) {
        const px = series.get(p.symbol)!.o[i];
        dayPnl += weight * (p.direction * (px / p.lastPx - 1) - roundTrip);
        logTrade(p, px, i, "time");
      } else {
        held.push(p);
      }
    }
    open = held;

    // 2 — new entries at the open of the event day, biggest gaps first.
    const todays = (eventsByDay.get(i) ?? [])
      .slice()
      .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap) || a.symbol.localeCompare(b.symbol));
    for (const e of todays) {
      if (open.length >= maxConcurrent) break;
      if (open.some((p) => p.symbol === e.symbol)) continue;
      const px = series.get(e.symbol)!.o[i];
      open.push({
        symbol: e.symbol,
        direction: (e.gap > 0 ? -1 : 1) as 1 | -1,
        entryIdx: i,
        entryPx: px,
        exitIdx: i + holdingDays,
        gap: e.gap,
        lastPx: px,
      });
    }
    if (open.length > 0) exposedDays++;

    // 3 — stops against today's range, then mark survivors to the close.
    const survivors: Position[] = [];
    for (const p of open) {
      const s = series.get(p.symbol)!;
      if (stopPct !== null && p.direction === -1 && s.h[i] >= p.entryPx * (1 + stopPct)) {
        const px = p.entryPx * (1 + stopPct + stopGap);
        dayPnl += weight * (p.direction * (px / p.lastPx - 1) - roundTrip);
        logTrade(p, px, i, "stop");
      } else if (stopPct !== null && p.direction === 1 && s.l[i] <= p.entryPx * (1 - stopPct)) {
        const px = p.entryPx * (1 - stopPct - stopGap);
        dayPnl += weight * (p.direction * (px / p.lastPx - 1) - roundTrip);
        logTrade(p, px, i, "stop");
      } else if (isBoundary) {
        const px = s.c[i];
        dayPnl += weight * (p.direction * (px / p.lastPx - 1) - roundTrip);
        logTrade(p, px, i, "end");
      } else {
        dayPnl += weight * p.direction * (s.c[i] / p.lastPx - 1);
        p.lastPx = s.c[i];
        survivors.push(p);
      }
    }
    open = isBoundary ? [] : survivors;

    equity *= 1 + dayPnl;
    equityByDay[d] = equity;
  }

  return { equityByDay, dayIndices, trades, exposedDays };
}

function round4(x: number): number {
  return Math.round(x * 1e4) / 1e4;
}
function round6(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

function summarize(out: EngineOutput): BacktestSummary {
  const { equityByDay, trades, dayIndices, exposedDays } = out;
  const n = equityByDay.length;
  const totalReturn = n ? equityByDay[n - 1] - 1 : 0;
  const years = n / TRADING_DAYS_PER_YEAR;
  const cagr = n ? Math.pow(1 + totalReturn, 1 / Math.max(years, 1e-9)) - 1 : 0;

  let prev = 1;
  let mean = 0;
  const rets: number[] = [];
  for (let i = 0; i < n; i++) {
    const r = equityByDay[i] / prev - 1;
    rets.push(r);
    mean += r;
    prev = equityByDay[i];
  }
  mean /= Math.max(n, 1);
  let variance = 0;
  for (const r of rets) variance += (r - mean) * (r - mean);
  variance /= Math.max(n - 1, 1);
  const sd = Math.sqrt(variance);
  const sharpe = sd > 0 ? (mean / sd) * Math.sqrt(TRADING_DAYS_PER_YEAR) : 0;

  let peak = 1;
  let maxDrawdown = 0;
  for (let i = 0; i < n; i++) {
    peak = Math.max(peak, equityByDay[i]);
    maxDrawdown = Math.min(maxDrawdown, equityByDay[i] / peak - 1);
  }

  const wins = trades.filter((t) => t.ret > 0).length;
  const avgHold = trades.length
    ? trades.reduce((a, t) => a + t.holdingDays, 0) / trades.length
    : 0;

  return {
    totalReturn: round6(totalReturn),
    cagr: round6(cagr),
    sharpe: round4(sharpe),
    maxDrawdown: round6(maxDrawdown),
    winRate: trades.length ? round4(wins / trades.length) : 0,
    trades: trades.length,
    avgHoldingDays: round4(avgHold),
    exposure: round4(exposedDays / Math.max(dayIndices.length, 1)),
  };
}

/** Summary alone, without materialising curves — what the grid loop uses. */
export function backtestSummary(strategy: Strategy, opts: BacktestOpts = {}): BacktestSummary {
  return summarize(replay(strategy, candidateEvents(strategy), opts));
}

/** Full portfolio replay. The dashboard's Strategy Lab renders this directly. */
export function runBacktest(strategy: Strategy, opts: BacktestOpts = {}): BacktestResult {
  const events = candidateEvents(strategy);
  const out = replay(strategy, events, opts);

  const equity: TrendPoint[] = [];
  const drawdown: TrendPoint[] = [];
  let peak = 1;
  for (let d = 0; d < out.dayIndices.length; d++) {
    const date = DATES[out.dayIndices[d]];
    const v = out.equityByDay[d];
    peak = Math.max(peak, v);
    equity.push({ date, value: round6(v) });
    drawdown.push({ date, value: round6(v / peak - 1) });
  }

  const byRegime = new Map<string, Trade[]>();
  for (const t of out.trades) {
    const list = byRegime.get(t.regime) ?? [];
    list.push(t);
    byRegime.set(t.regime, list);
  }
  const regimeStats: RegimeStat[] = [...byRegime.entries()]
    .map(([regime, ts]) => ({
      regime: regime as RegimeStat["regime"],
      trades: ts.length,
      totalReturn: round6(ts.reduce((a, t) => a * (1 + t.ret), 1) - 1),
      winRate: round4(ts.filter((t) => t.ret > 0).length / ts.length),
      avgReturn: round6(ts.reduce((a, t) => a + t.ret, 0) / ts.length),
    }))
    .sort((a, b) => a.regime.localeCompare(b.regime));

  return {
    agent: "backtester",
    timestamp: overnight(151), // 02:31 — right after the coder handed over
    asset: "STRATEGY",
    horizon: "cycle",
    trend_context: equity.slice(-90),
    strategyId: strategy.id,
    summary: summarize(out),
    equity,
    drawdown,
    tradeLog: out.trades,
    regimeStats,
    elapsedMs: 11_842, // five years in ~12 seconds, per the desk's lore
  };
}

/**
 * The terrain. Runs the full engine at every grid point — cheap enough to do
 * live in the browser when a parameter changes, which is what lets the
 * /explore surface deform in real time.
 */
export function computeSurface(
  strategy: Strategy,
  axes: { thresholds: number[]; holdings: number[] },
  opts: BacktestOpts = {},
): Surface {
  const cells: number[][] = [];
  for (const minGap of axes.thresholds) {
    const row: number[] = [];
    // The terrain drops the strategy's own gap cap: the landscape has to show
    // the territory beyond the ridge, where gaps are information and the fade
    // dies — that's the region the storm and the ghost talk about.
    const variant: Strategy = { ...strategy, entry: { style: "fade", minGap } };
    const events = candidateEvents(variant);
    for (const holdingDays of axes.holdings) {
      const cell: Strategy = { ...variant, exit: { ...variant.exit, holdingDays } };
      const out = replay(cell, events, opts);
      const n = out.equityByDay.length;
      row.push(round6(n ? out.equityByDay[n - 1] - 1 : 0));
    }
    cells.push(row);
  }
  return { thresholds: axes.thresholds, holdings: axes.holdings, cells, metric: "totalReturn" };
}

/** Default grid both surfaces share, so a crater on one is a crater on the other. */
export const SURFACE_AXES = {
  thresholds: Array.from({ length: 21 }, (_, i) => round4(0.01 + i * 0.007)),
  holdings: Array.from({ length: 21 }, (_, i) => 1 + i),
};
