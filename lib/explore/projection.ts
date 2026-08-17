/**
 * Every coordinate mapping for the /explore scene lives here, so the terrain,
 * the persona layer, the storm and the ghost all agree about where things are.
 *
 * World frame: terrain spans x ∈ [-10, 10] (entry threshold, 1% → 15%),
 * z ∈ [-10, 10] (holding period, 1 → 21 days), y = realized return × HEIGHT_SCALE.
 */
import { SURFACE_AXES } from "../agents/backtester";
import type { Surface } from "../agents/types";

export const SPAN = 10; // half-extent of the terrain in world units
export const HEIGHT_SCALE = 28; // +12% return ≈ 3.4 world units of relief

// Shader constants, lifted here so the legend and the axis ladder can state
// them without drifting out of sync with the terrain material.
export const CONTOUR_STEP = 0.015; // iso-line every 1.5% of return
export const PROFIT_RAMP = 0.12; // return at which the amber tint saturates

// The return ladder. Tick semantics are fixed — a tick is always the same
// world distance — only the post's drawn extent adapts to the surface, so
// height never changes meaning as the scrubber moves. The envelope covers
// every reachable surface (measured: −26% storm-stressed → +30% mid-window).
export const RETURN_TICK_STEP = 0.05;
export const RETURN_LABEL_STEP = 0.1;
export const RETURN_AXIS_MIN = -0.3;
export const RETURN_AXIS_MAX = 0.35;

/** World-unit gap between the mesh edge and axis furniture. */
export const AXIS_OFFSET = 0.9;

/** Labeled positions: round percentages, not grid indices. */
export const THRESHOLD_TICKS = [0.01, 0.03, 0.05, 0.07, 0.09, 0.11, 0.13, 0.15];
export const HOLDING_TICKS = [1, 5, 9, 13, 17, 21];

// The persona layer's own frame — must match personaToWorld below.
export const PERSONA_FLOOR_Y = 4.5;
export const PERSONA_CEIL_Y = 7.0;

export function returnToWorldY(r: number): number {
  return r * HEIGHT_SCALE;
}

export const T_MIN = SURFACE_AXES.thresholds[0];
export const T_MAX = SURFACE_AXES.thresholds[SURFACE_AXES.thresholds.length - 1];
export const H_MIN = SURFACE_AXES.holdings[0];
export const H_MAX = SURFACE_AXES.holdings[SURFACE_AXES.holdings.length - 1];

/** Seconds the breaker's front takes to cross the terrain. Storm and Terrain share it. */
export const STORM_SWEEP_SECONDS = 6;

/** (minGap, holdingDays) → world x/z. */
export function paramToWorld(minGap: number, holdingDays: number): [number, number] {
  const u = (minGap - T_MIN) / (T_MAX - T_MIN);
  const v = (holdingDays - H_MIN) / (H_MAX - H_MIN);
  return [-SPAN + 2 * SPAN * u, -SPAN + 2 * SPAN * v];
}

/** world x/z → (minGap, holdingDays). Clamped to the grid. */
export function worldToParam(x: number, z: number): { minGap: number; holdingDays: number } {
  const u = Math.min(1, Math.max(0, (x + SPAN) / (2 * SPAN)));
  const v = Math.min(1, Math.max(0, (z + SPAN) / (2 * SPAN)));
  return { minGap: T_MIN + u * (T_MAX - T_MIN), holdingDays: H_MIN + v * (H_MAX - H_MIN) };
}

/** Bilinear sample of a surface at grid fractions u, v ∈ [0, 1]. */
export function sampleSurface(s: Surface, u: number, v: number): number {
  const nT = s.thresholds.length;
  const nH = s.holdings.length;
  const ft = Math.min(1, Math.max(0, u)) * (nT - 1);
  const fh = Math.min(1, Math.max(0, v)) * (nH - 1);
  const t0 = Math.floor(ft);
  const h0 = Math.floor(fh);
  const t1 = Math.min(t0 + 1, nT - 1);
  const h1 = Math.min(h0 + 1, nH - 1);
  const at = ft - t0;
  const ah = fh - h0;
  const a = s.cells[t0][h0] * (1 - at) + s.cells[t1][h0] * at;
  const b = s.cells[t0][h1] * (1 - at) + s.cells[t1][h1] * at;
  return a * (1 - ah) + b * ah;
}

/**
 * The fifty float above the terrain as a weather layer of opinion:
 * x = signed view (bearish left, bullish right), z = the slice they read
 * (ten family bands, five readers spread inside each), y = conviction.
 */
export function personaToWorld(
  signal: number,
  familyIndex: number,
  withinFamily: number,
  conviction: number,
): [number, number, number] {
  const x = signal * SPAN;
  const band = -SPAN + ((familyIndex + 0.5) / 10) * 2 * SPAN;
  const z = band + (withinFamily - 2) * 0.36;
  const y = 4.5 + conviction * 2.5;
  return [x, y, z];
}

export function familyIndexOf(personaId: number): number {
  return Math.floor(personaId / 5);
}

export function withinFamilyOf(personaId: number): number {
  return personaId % 5;
}
