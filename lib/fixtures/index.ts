/**
 * The fixture data layer. Everything downstream — agents, dashboard, /explore —
 * reads the market through here and never touches the generator.
 *
 * Prices are synthetic. Tickers are real, the history is modelled.
 */
import barsJson from "./data/bars.json";
import eventsJson from "./data/events.json";
import marketJson from "./data/market.json";
import universeJson from "./data/universe.json";

import type {
  Asset,
  Bar,
  BarSeries,
  BarsFile,
  EventsFile,
  MarketEvent,
  MarketFile,
  RegimeDef,
  RegimeId,
  RegimeSegment,
  UniverseFile,
} from "./types";

export * from "./types";
export { START_DATE, END_DATE } from "./generate";

const universe = universeJson as unknown as UniverseFile;
const bars = barsJson as unknown as BarsFile;
const market = marketJson as unknown as MarketFile;
const events = eventsJson as unknown as EventsFile;

export const META = universe.meta;
export const ASSETS: Asset[] = universe.assets;
export const SYMBOLS: string[] = ASSETS.map((a) => a.symbol);
export const DATES: string[] = bars.dates;
export const REGIMES: RegimeDef[] = market.regimes;
export const SEGMENTS: RegimeSegment[] = market.segments;
export const EVENTS: MarketEvent[] = events.events;
export const MARKET_RETURN: number[] = market.marketReturn;
export const VIX: number[] = market.vix;
export const REGIME_BY_DAY: RegimeId[] = market.regimeByDay;

const assetBySymbol = new Map(ASSETS.map((a) => [a.symbol, a]));
const indexByDate = new Map(DATES.map((d, i) => [d, i]));

export function getAsset(symbol: string): Asset {
  const asset = assetBySymbol.get(symbol);
  if (!asset) throw new Error(`unknown symbol: ${symbol}`);
  return asset;
}

/** Position of an ISO date in the shared date axis, or -1. */
export function dateIndex(date: string): number {
  return indexByDate.get(date) ?? -1;
}

/** Raw columnar series — cheapest access, no allocation. */
export function getSeries(symbol: string): BarSeries {
  const s = bars.series[symbol];
  if (!s) throw new Error(`no bars for symbol: ${symbol}`);
  return s;
}

/** Close series. The common case. */
export function getCloses(symbol: string): number[] {
  return getSeries(symbol).c;
}

/** Materialised bars. Slice with `from`/`to` indices to avoid building all 1250. */
export function getBars(symbol: string, from = 0, to = DATES.length): Bar[] {
  const s = getSeries(symbol);
  const out: Bar[] = [];
  for (let i = Math.max(0, from); i < Math.min(to, DATES.length); i++) {
    out.push({
      date: DATES[i],
      open: s.o[i],
      high: s.h[i],
      low: s.l[i],
      close: s.c[i],
      volume: s.v[i],
    });
  }
  return out;
}

export function getBar(symbol: string, date: string): Bar | null {
  const i = dateIndex(date);
  if (i < 0) return null;
  return getBars(symbol, i, i + 1)[0] ?? null;
}

/** The most recent N closes for a symbol — the trailing series every metric renders with. */
export function trailing(symbol: string, sessions: number, endIndex = DATES.length - 1): number[] {
  const s = getCloses(symbol);
  return s.slice(Math.max(0, endIndex - sessions + 1), endIndex + 1);
}

export function regimeOn(date: string): RegimeId | null {
  const i = dateIndex(date);
  return i < 0 ? null : REGIME_BY_DAY[i];
}

export function eventsOn(date: string): MarketEvent[] {
  return EVENTS.filter((e) => e.date === date);
}

export function eventsFor(symbol: string): MarketEvent[] {
  return EVENTS.filter((e) => e.symbol === symbol);
}

/** The last session in the fixture window — "last night" for every surface. */
export const LATEST_DATE = DATES[DATES.length - 1];
export const LATEST_INDEX = DATES.length - 1;
