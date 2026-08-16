/** Shared shapes for the fixture data layer. Both surfaces read these. */

export type Sector =
  | "Technology"
  | "Financials"
  | "Healthcare"
  | "Biotech"
  | "Energy"
  | "Consumer"
  | "Industrials"
  | "Index"
  | "Volatility";

export type CapTier = "mega" | "large" | "mid" | "small" | "index";

export type RegimeId =
  | "expansion"
  | "late_cycle"
  | "chop"
  | "correction"
  | "crisis"
  | "recovery";

export interface Asset {
  symbol: string;
  name: string;
  sector: Sector;
  cap: CapTier;
  /** Sensitivity to the market factor. */
  beta: number;
  /** Loading on the asset's own sector factor. */
  sectorLoading: number;
  /** Annualised *residual* volatility, after market and sector factors. */
  idioVol: number;
  /** Annualised drift not explained by market or sector. */
  alpha: number;
  /** First close of the series, in dollars. */
  startPrice: number;
  /** Typical daily share volume. */
  baseVolume: number;
  /** Trading days between scheduled earnings reports. 0 = none. */
  earningsCadence: number;
  /** Mean trading days between unscheduled catalysts (FDA, M&A, guidance). 0 = none. */
  catalystCadence: number;
  /** Typical catalyst gap, as a fraction. Small-cap biotech gaps hardest. */
  catalystGapScale: number;
}

export interface RegimeDef {
  id: RegimeId;
  label: string;
  /** Annualised market drift while in this regime. */
  drift: number;
  /** Annualised market volatility while in this regime. */
  vol: number;
  /** Daily probability of a fat-tailed shock. */
  shockProb: number;
  /** Level VIX mean-reverts toward in this regime. */
  vixTarget: number;
  /** Expected duration in trading days, from the transition matrix. */
  expectedDays: number;
}

export interface RegimeSegment {
  regime: RegimeId;
  startDate: string;
  endDate: string;
  days: number;
  /** SPY total return across the segment. */
  spyReturn: number;
  /** Worst peak-to-trough in SPY inside the segment. */
  spyMaxDrawdown: number;
  meanVix: number;
}

export type EventKind = "earnings" | "fda" | "guidance" | "macro" | "ma_rumor";

export interface MarketEvent {
  date: string;
  symbol: string;
  kind: EventKind;
  /** Overnight gap the event caused, as a return on the prior close. */
  gap: number;
  /** Regime the event landed in. */
  regime: RegimeId;
  headline: string;
}

/** Columnar bar series. Index i of every array corresponds to `dates[i]`. */
export interface BarSeries {
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  v: number[];
}

export interface Bar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FixtureMeta {
  seed: number;
  generator: string;
  startDate: string;
  endDate: string;
  tradingDays: number;
  /** Always true. These are modelled prices, not market data. */
  synthetic: true;
}

export interface UniverseFile {
  meta: FixtureMeta;
  assets: Asset[];
}

export interface BarsFile {
  meta: FixtureMeta;
  dates: string[];
  series: Record<string, BarSeries>;
}

export interface MarketFile {
  meta: FixtureMeta;
  dates: string[];
  regimes: RegimeDef[];
  /** Regime in force on each date. */
  regimeByDay: RegimeId[];
  /** Daily market-factor return. */
  marketReturn: number[];
  /** Daily VIX close, carried here as well as in bars for convenience. */
  vix: number[];
  segments: RegimeSegment[];
}

export interface EventsFile {
  meta: FixtureMeta;
  events: MarketEvent[];
}
