/**
 * Shared contract for the five overnight agents.
 *
 * Every output — a persona's view, a backtest, a stress verdict — carries the
 * same envelope: when it ran, what it's about, over what horizon, and the
 * series that puts it in context. The dashboard and /explore both consume
 * these shapes and nothing else.
 */
import type { CapTier, EventKind, RegimeId, Sector } from "../fixtures/types";

export type AgentId = "personas" | "coder" | "backtester" | "breaker" | "critic";

export type Horizon = "overnight" | "1w" | "1m" | "1q" | "cycle";

export interface TrendPoint {
  date: string;
  value: number;
}

/** The envelope. No agent output ships without these four fields. */
export interface AgentOutput {
  agent: AgentId;
  /** ISO datetime of the overnight run that produced this. */
  timestamp: string;
  /** Symbol, or a scope tag: "UNIVERSE", "STRATEGY", "JOURNAL". */
  asset: string;
  horizon: Horizon;
  /** The series the UI renders beside the finding. Never empty. */
  trend_context: TrendPoint[];
}

// ---------------------------------------------------------------------------
// Strategy object — what the coder emits and the backtester executes.
// ---------------------------------------------------------------------------

export interface StrategyFilter {
  sectors?: Sector[];
  caps?: CapTier[];
  symbols?: string[];
}

export interface Strategy {
  id: string;
  name: string;
  /** The plain-English sentence the coder compiled. */
  sentence: string;
  filter: StrategyFilter;
  trigger: { kind: EventKind };
  /**
   * Fade: trade against the overnight gap when |gap| clears the threshold.
   * `maxGap` skips gaps so large they're information rather than noise.
   */
  entry: { style: "fade"; minGap: number; maxGap?: number };
  exit: { holdingDays: number; stopPct: number | null };
  sizing: { scheme: "equal_slot"; grossTargetPct: number; maxConcurrent: number };
  costs: { perSideBps: number; slippageBps: number };
}

// ---------------------------------------------------------------------------
// Backtester
// ---------------------------------------------------------------------------

export interface BacktestOpts {
  /** Scale all commissions and slippage. Breaker sets 2. */
  costMultiplier?: number;
  /** Extra slippage on every fill, in bps. Breaker's shock. */
  extraSlippageBps?: number;
  /** Stops fill this many bps through the stop price. */
  stopGapBps?: number;
  /** Halve the book: fewer slots, same per-slot weight. */
  maxConcurrentOverride?: number;
  /** Replay only these [startIndex, endIndex] windows, concatenated. */
  windows?: Array<[number, number]>;
  /** Ignore signals after this date index (time scrubber). */
  endIndex?: number;
}

export interface Trade {
  symbol: string;
  entryDate: string;
  exitDate: string;
  /** +1 long, -1 short. Fade means opposite the gap. */
  direction: 1 | -1;
  entryPx: number;
  exitPx: number;
  gapAtEntry: number;
  /** Net return on the position, costs included. */
  ret: number;
  regime: RegimeId;
  holdingDays: number;
  exitReason: "time" | "stop" | "end";
}

export interface RegimeStat {
  regime: RegimeId;
  trades: number;
  totalReturn: number;
  winRate: number;
  avgReturn: number;
}

export interface BacktestSummary {
  totalReturn: number;
  cagr: number;
  sharpe: number;
  maxDrawdown: number;
  winRate: number;
  trades: number;
  avgHoldingDays: number;
  /** Fraction of sessions with at least one open position. */
  exposure: number;
}

export interface BacktestResult extends AgentOutput {
  agent: "backtester";
  strategyId: string;
  summary: BacktestSummary;
  equity: TrendPoint[];
  drawdown: TrendPoint[];
  tradeLog: Trade[];
  regimeStats: RegimeStat[];
  /** Wall-clock the replay "took" overnight, for the narrative. */
  elapsedMs: number;
}

/** The terrain: total return over a grid of (entry threshold × holding days). */
export interface Surface {
  thresholds: number[];
  holdings: number[];
  /** cells[ti][hi] = strategy total return at that parameter point. */
  cells: number[][];
  metric: "totalReturn";
}

// ---------------------------------------------------------------------------
// Coder
// ---------------------------------------------------------------------------

export interface StrategyDraft {
  version: number;
  strategy: Strategy;
  /** What this draft got wrong — discovered when the backtester ran it. */
  broke: string | null;
  /** What this draft changed relative to the one before. */
  fixed: string | null;
  preview: { cagr: number; maxDrawdown: number; sharpe: number; trades: number };
}

export interface CoderOutput extends AgentOutput {
  agent: "coder";
  sentence: string;
  drafts: StrategyDraft[];
  final: Strategy;
}

// ---------------------------------------------------------------------------
// Personas
// ---------------------------------------------------------------------------

export type PersonaFamily =
  | "filings"
  | "transcripts"
  | "options_flow"
  | "on_chain"
  | "macro"
  | "sector_news"
  | "technicals"
  | "credit"
  | "positioning"
  | "alt_data";

export interface PersonaView extends AgentOutput {
  agent: "personas";
  personaId: number;
  name: string;
  family: PersonaFamily;
  /** Directional view on `asset` this session. */
  direction: -1 | 0 | 1;
  /** 0..1. */
  conviction: number;
  rationale: string;
  /** Signed conviction, -1..1 — what trend_context and the 3D trail plot. */
  signal: number;
}

export interface PersonaCluster {
  label: string;
  /** Mean signed conviction of the members. */
  center: number;
  members: number[];
}

export interface PersonasSummary extends AgentOutput {
  agent: "personas";
  /** Mean signed conviction across all fifty, tonight. */
  consensus: number;
  /** Cross-sectional std of signed conviction, tonight. */
  dispersion: number;
  /** True when tonight's dispersion clears the 80th percentile of the last year. */
  fractured: boolean;
  /**
   * Does fracture predict anything: mean |SPY fwd 5d return| after fractured
   * sessions vs all sessions, over the whole window.
   */
  fractureEdge: { afterFracture: number; baseline: number };
  clusters: PersonaCluster[];
}

// ---------------------------------------------------------------------------
// Breaker
// ---------------------------------------------------------------------------

export interface StressResult {
  id: string;
  label: string;
  /** What the stress does to the world, in one line. */
  description: string;
  opts: BacktestOpts;
  base: BacktestSummary;
  stressed: BacktestSummary;
  /** stressed cagr minus base cagr. */
  cagrDelta: number;
  ddDelta: number;
  broke: boolean;
  /** 0..1 — how much of the strategy's return the stress destroyed. */
  severity: number;
}

export interface BreakerOutput extends AgentOutput {
  agent: "breaker";
  strategyId: string;
  stresses: StressResult[];
  /** The stress that did the most damage. */
  killer: StressResult;
  verdict: string;
  /** The ten worst historical windows the replay used, newest first. */
  worstWindows: Array<{ regime: RegimeId; startDate: string; endDate: string; spyReturn: number }>;
}

// ---------------------------------------------------------------------------
// Critic
// ---------------------------------------------------------------------------

export interface JournalEntry {
  date: string;
  symbol: string;
  action: "add" | "cut" | "skip" | "flip";
  /** Size in R — multiples of the standard risk unit. */
  sizeR: number;
  note: string;
  /** Where on the terrain the decision lived, when it was a strategy tweak. */
  params?: { minGap: number; holdingDays: number };
  /** Realized outcome of the decision, as a return. */
  outcome: number;
}

export interface FlaggedRegion {
  /** Parameter-space rectangle the critic keeps seeing the user return to. */
  minGap: [number, number];
  holdingDays: [number, number];
  whisper: string;
  /** Journal dates that put this region on the map. */
  evidence: string[];
}

export interface CriticOutput extends AgentOutput {
  agent: "critic";
  pattern: string;
  diagnosis: string;
  /** The two or three decisions that triggered the diagnosis. */
  evidence: JournalEntry[];
  journal: JournalEntry[];
  flaggedRegions: FlaggedRegion[];
}
