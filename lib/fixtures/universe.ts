import type { Asset, RegimeId, Sector } from "./types";

/**
 * Twenty US equities across seven sectors, plus SPY and VIX.
 *
 * Tickers are real; every price in this repo is not. The parameters below are
 * hand-set so each name behaves in character — mega-cap tech carries beta and
 * momentum, small-cap biotech is nearly market-neutral but gaps violently on
 * catalysts, energy hedges the inflation regimes.
 *
 * `idioVol` is *residual* volatility only. Total volatility comes out as
 * roughly sqrt((beta·σ_mkt)² + (loading·σ_sector)² + idioVol²), so these numbers
 * are much smaller than the headline vol you'd quote for the name.
 */
export const ASSETS: Asset[] = [
  // Technology
  { symbol: "NVDA", name: "NVIDIA", sector: "Technology", cap: "mega", beta: 1.62, sectorLoading: 1.15, idioVol: 0.22, alpha: 0.10, startPrice: 21.4, baseVolume: 310_000_000, earningsCadence: 63, catalystCadence: 0, catalystGapScale: 0 },
  { symbol: "MSFT", name: "Microsoft", sector: "Technology", cap: "mega", beta: 1.04, sectorLoading: 0.82, idioVol: 0.09, alpha: 0.04, startPrice: 295.0, baseVolume: 24_000_000, earningsCadence: 63, catalystCadence: 0, catalystGapScale: 0 },
  { symbol: "AAPL", name: "Apple", sector: "Technology", cap: "mega", beta: 1.11, sectorLoading: 0.74, idioVol: 0.11, alpha: 0.015, startPrice: 148.0, baseVolume: 62_000_000, earningsCadence: 63, catalystCadence: 0, catalystGapScale: 0 },
  { symbol: "AMD", name: "Advanced Micro Devices", sector: "Technology", cap: "large", beta: 1.74, sectorLoading: 1.05, idioVol: 0.24, alpha: 0.0, startPrice: 108.0, baseVolume: 58_000_000, earningsCadence: 63, catalystCadence: 0, catalystGapScale: 0 },

  // Financials
  { symbol: "JPM", name: "JPMorgan Chase", sector: "Financials", cap: "mega", beta: 1.08, sectorLoading: 0.94, idioVol: 0.09, alpha: 0.02, startPrice: 152.0, baseVolume: 10_500_000, earningsCadence: 63, catalystCadence: 0, catalystGapScale: 0 },
  { symbol: "GS", name: "Goldman Sachs", sector: "Financials", cap: "large", beta: 1.26, sectorLoading: 1.08, idioVol: 0.11, alpha: 0.01, startPrice: 408.0, baseVolume: 2_400_000, earningsCadence: 63, catalystCadence: 0, catalystGapScale: 0 },
  { symbol: "SCHW", name: "Charles Schwab", sector: "Financials", cap: "large", beta: 1.19, sectorLoading: 1.02, idioVol: 0.13, alpha: -0.02, startPrice: 71.0, baseVolume: 9_800_000, earningsCadence: 63, catalystCadence: 320, catalystGapScale: 0.04 },

  // Healthcare
  { symbol: "LLY", name: "Eli Lilly", sector: "Healthcare", cap: "mega", beta: 0.62, sectorLoading: 0.71, idioVol: 0.15, alpha: 0.11, startPrice: 246.0, baseVolume: 3_600_000, earningsCadence: 63, catalystCadence: 180, catalystGapScale: 0.05 },
  { symbol: "VRTX", name: "Vertex Pharmaceuticals", sector: "Healthcare", cap: "large", beta: 0.54, sectorLoading: 0.78, idioVol: 0.16, alpha: 0.04, startPrice: 194.0, baseVolume: 1_500_000, earningsCadence: 63, catalystCadence: 120, catalystGapScale: 0.07 },

  // Biotech — the gap-fade universe
  { symbol: "SRPT", name: "Sarepta Therapeutics", sector: "Biotech", cap: "small", beta: 0.48, sectorLoading: 1.22, idioVol: 0.34, alpha: -0.04, startPrice: 74.0, baseVolume: 1_400_000, earningsCadence: 63, catalystCadence: 58, catalystGapScale: 0.105 },
  { symbol: "IONS", name: "Ionis Pharmaceuticals", sector: "Biotech", cap: "small", beta: 0.41, sectorLoading: 1.14, idioVol: 0.30, alpha: -0.02, startPrice: 38.0, baseVolume: 1_900_000, earningsCadence: 63, catalystCadence: 66, catalystGapScale: 0.09 },
  { symbol: "ARWR", name: "Arrowhead Pharmaceuticals", sector: "Biotech", cap: "small", beta: 0.55, sectorLoading: 1.31, idioVol: 0.38, alpha: -0.07, startPrice: 69.0, baseVolume: 1_700_000, earningsCadence: 63, catalystCadence: 52, catalystGapScale: 0.125 },
  { symbol: "CRSP", name: "CRISPR Therapeutics", sector: "Biotech", cap: "small", beta: 0.63, sectorLoading: 1.28, idioVol: 0.40, alpha: -0.09, startPrice: 118.0, baseVolume: 2_200_000, earningsCadence: 63, catalystCadence: 61, catalystGapScale: 0.12 },

  // Energy
  { symbol: "XOM", name: "Exxon Mobil", sector: "Energy", cap: "mega", beta: 0.83, sectorLoading: 1.06, idioVol: 0.11, alpha: 0.03, startPrice: 55.0, baseVolume: 19_000_000, earningsCadence: 63, catalystCadence: 0, catalystGapScale: 0 },
  { symbol: "SLB", name: "SLB", sector: "Energy", cap: "large", beta: 1.14, sectorLoading: 1.24, idioVol: 0.16, alpha: 0.0, startPrice: 29.0, baseVolume: 12_500_000, earningsCadence: 63, catalystCadence: 0, catalystGapScale: 0 },
  { symbol: "OXY", name: "Occidental Petroleum", sector: "Energy", cap: "large", beta: 1.31, sectorLoading: 1.35, idioVol: 0.18, alpha: -0.03, startPrice: 26.0, baseVolume: 14_000_000, earningsCadence: 63, catalystCadence: 250, catalystGapScale: 0.05 },

  // Consumer
  { symbol: "AMZN", name: "Amazon", sector: "Consumer", cap: "mega", beta: 1.28, sectorLoading: 0.88, idioVol: 0.15, alpha: 0.03, startPrice: 166.0, baseVolume: 45_000_000, earningsCadence: 63, catalystCadence: 0, catalystGapScale: 0 },
  { symbol: "COST", name: "Costco", sector: "Consumer", cap: "mega", beta: 0.74, sectorLoading: 0.62, idioVol: 0.10, alpha: 0.06, startPrice: 448.0, baseVolume: 2_100_000, earningsCadence: 63, catalystCadence: 0, catalystGapScale: 0 },

  // Industrials
  { symbol: "CAT", name: "Caterpillar", sector: "Industrials", cap: "large", beta: 1.06, sectorLoading: 1.02, idioVol: 0.12, alpha: 0.04, startPrice: 207.0, baseVolume: 3_300_000, earningsCadence: 63, catalystCadence: 0, catalystGapScale: 0 },
  { symbol: "UNP", name: "Union Pacific", sector: "Industrials", cap: "large", beta: 0.94, sectorLoading: 0.96, idioVol: 0.11, alpha: -0.01, startPrice: 222.0, baseVolume: 2_600_000, earningsCadence: 63, catalystCadence: 0, catalystGapScale: 0 },

  // Benchmarks
  { symbol: "SPY", name: "SPDR S&P 500 ETF", sector: "Index", cap: "index", beta: 1.0, sectorLoading: 0, idioVol: 0.012, alpha: 0, startPrice: 442.0, baseVolume: 78_000_000, earningsCadence: 0, catalystCadence: 0, catalystGapScale: 0 },
  { symbol: "VIX", name: "CBOE Volatility Index", sector: "Volatility", cap: "index", beta: 0, sectorLoading: 0, idioVol: 0, alpha: 0, startPrice: 16.5, baseVolume: 0, earningsCadence: 0, catalystCadence: 0, catalystGapScale: 0 },
];

export const EQUITIES = ASSETS.filter(
  (a) => a.sector !== "Index" && a.sector !== "Volatility",
);

export const BY_SYMBOL: Record<string, Asset> = Object.fromEntries(
  ASSETS.map((a) => [a.symbol, a]),
);

/** Sectors that carry their own factor. Index and Volatility do not. */
export const FACTOR_SECTORS = [
  "Technology",
  "Financials",
  "Healthcare",
  "Biotech",
  "Energy",
  "Consumer",
  "Industrials",
] as const satisfies readonly Sector[];

export type FactorSector = (typeof FACTOR_SECTORS)[number];

/** Annualised sector-factor volatility, independent of the market factor. */
export const SECTOR_VOL: Record<FactorSector, number> = {
  Technology: 0.12,
  Financials: 0.10,
  Healthcare: 0.09,
  Biotech: 0.22,
  Energy: 0.16,
  Consumer: 0.09,
  Industrials: 0.08,
};

/**
 * Annualised sector drift by regime. This is where rotation comes from: energy
 * carries late-cycle and correction, biotech only pays in recovery, tech leads
 * expansion and takes the worst of a crisis.
 */
export const SECTOR_REGIME_DRIFT: Record<FactorSector, Record<RegimeId, number>> = {
  Technology: { expansion: 0.07, late_cycle: -0.02, chop: 0.0, correction: -0.09, crisis: -0.17, recovery: 0.14 },
  Financials: { expansion: 0.03, late_cycle: 0.035, chop: 0.0, correction: -0.05, crisis: -0.19, recovery: 0.09 },
  Healthcare: { expansion: -0.01, late_cycle: 0.025, chop: 0.02, correction: 0.045, crisis: 0.08, recovery: -0.03 },
  Biotech: { expansion: -0.03, late_cycle: -0.055, chop: -0.04, correction: -0.11, crisis: -0.21, recovery: 0.20 },
  Energy: { expansion: 0.01, late_cycle: 0.115, chop: 0.02, correction: 0.055, crisis: -0.08, recovery: 0.04 },
  Consumer: { expansion: 0.025, late_cycle: -0.02, chop: 0.005, correction: -0.03, crisis: -0.06, recovery: 0.07 },
  Industrials: { expansion: 0.03, late_cycle: 0.02, chop: 0.0, correction: -0.045, crisis: -0.10, recovery: 0.08 },
};
