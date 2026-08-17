/**
 * Surface computation and caching for /explore. A full 21×21 grid runs the
 * backtest engine 441 times (~100–400ms), so nothing here is ever called
 * during render — callers compute in effects and cache hits are free.
 */
import { computeSurface, SURFACE_AXES } from "../agents/backtester";
import { STORM_OPTS } from "../agents/breaker";
import { STRATEGY } from "../agents/coder";
import type { BacktestOpts, Surface } from "../agents/types";
import { LATEST_INDEX } from "../fixtures";

const QUANT = 10;
/** Earliest scrubbable session — one year in, so every surface has data. */
export const MIN_TIME_INDEX = 252;

/** Snap a session index to the scrubber's grid; the latest session stays exact. */
export function quantizeIndex(idx: number): number {
  if (idx >= LATEST_INDEX - QUANT / 2) return LATEST_INDEX;
  const q = Math.round(idx / QUANT) * QUANT;
  return Math.max(MIN_TIME_INDEX, Math.min(q, LATEST_INDEX));
}

class Lru {
  private map = new Map<string, Surface>();
  constructor(private readonly cap: number) {}
  get(key: string): Surface | undefined {
    const v = this.map.get(key);
    if (v) {
      this.map.delete(key);
      this.map.set(key, v);
    }
    return v;
  }
  set(key: string, value: Surface): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.cap) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }
  has(key: string): boolean {
    return this.map.has(key);
  }
}

const cache = new Lru(24);

function keyed(kind: "base" | "storm", endIndex: number): string {
  return `${kind}:${endIndex}`;
}

function compute(kind: "base" | "storm", endIndex: number): Surface {
  const key = keyed(kind, endIndex);
  const hit = cache.get(key);
  if (hit) return hit;
  const opts: BacktestOpts =
    kind === "storm"
      ? { ...STORM_OPTS, endIndex: endIndex === LATEST_INDEX ? undefined : endIndex }
      : endIndex === LATEST_INDEX
        ? {}
        : { endIndex };
  const s = computeSurface(STRATEGY, SURFACE_AXES, opts);
  cache.set(key, s);
  return s;
}

/** The strategy's landscape over the full window. */
export function baseSurface(): Surface {
  return compute("base", LATEST_INDEX);
}

/** The same landscape after the breaker: worst windows, doubled costs. */
export function stormSurface(): Surface {
  return compute("storm", LATEST_INDEX);
}

/** The landscape as of a (quantized) moment in time — the scrubber's view. */
export function surfaceAt(endIndex: number): Surface {
  return compute("base", quantizeIndex(endIndex));
}

/** The stressed landscape as of a moment in time. */
export function stormSurfaceAt(endIndex: number): Surface {
  return compute("storm", quantizeIndex(endIndex));
}

export function isCached(kind: "base" | "storm", endIndex: number): boolean {
  return cache.has(keyed(kind, quantizeIndex(endIndex)));
}
