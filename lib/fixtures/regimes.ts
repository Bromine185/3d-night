import type { RegimeDef, RegimeId } from "./types";

/**
 * Six-state Markov chain over market regimes. Self-transition probabilities are
 * high, so the chain produces long stretches with sharp handoffs — the texture
 * the backtester needs to show regime-tagged performance and the breaker needs
 * to have genuinely hostile stretches to replay.
 */

export const REGIME_ORDER: RegimeId[] = [
  "expansion",
  "late_cycle",
  "chop",
  "correction",
  "crisis",
  "recovery",
];

export const REGIME_DEFS: Record<RegimeId, Omit<RegimeDef, "expectedDays">> = {
  expansion: {
    id: "expansion",
    label: "Expansion",
    drift: 0.26,
    vol: 0.11,
    shockProb: 0.003,
    vixTarget: 14,
  },
  late_cycle: {
    id: "late_cycle",
    label: "Late cycle",
    drift: 0.13,
    vol: 0.15,
    shockProb: 0.008,
    vixTarget: 18,
  },
  chop: {
    id: "chop",
    label: "Chop",
    drift: 0.01,
    vol: 0.17,
    shockProb: 0.012,
    vixTarget: 21,
  },
  correction: {
    id: "correction",
    label: "Correction",
    drift: -0.26,
    vol: 0.26,
    shockProb: 0.028,
    vixTarget: 29,
  },
  crisis: {
    id: "crisis",
    label: "Crisis",
    drift: -0.70,
    vol: 0.47,
    shockProb: 0.075,
    vixTarget: 48,
  },
  recovery: {
    id: "recovery",
    label: "Recovery",
    drift: 0.50,
    vol: 0.27,
    shockProb: 0.02,
    vixTarget: 25,
  },
};

/**
 * Row i = distribution over next state given current state i, in REGIME_ORDER.
 * Rows are normalised at load, so these read as intent rather than arithmetic.
 */
export const TRANSITIONS: Record<RegimeId, number[]> = {
  //            expansion late_cycle  chop    correction crisis  recovery
  expansion: [0.9880, 0.0075, 0.0037, 0.0008, 0.0000, 0.0000],
  late_cycle: [0.0040, 0.9830, 0.0083, 0.0045, 0.0002, 0.0000],
  chop: [0.0088, 0.0062, 0.9750, 0.0088, 0.0012, 0.0000],
  correction: [0.0000, 0.0090, 0.0210, 0.9580, 0.0060, 0.0060],
  crisis: [0.0000, 0.0000, 0.0100, 0.0200, 0.9300, 0.0400],
  recovery: [0.0150, 0.0050, 0.0050, 0.0020, 0.0005, 0.9725],
};

/** Expected dwell time in trading days, 1 / (1 - p_self). */
export function expectedDays(regime: RegimeId): number {
  const row = TRANSITIONS[regime];
  const total = row.reduce((a, b) => a + b, 0);
  const pSelf = row[REGIME_ORDER.indexOf(regime)] / total;
  return Math.round(1 / (1 - pSelf));
}

export function regimeDefs(): RegimeDef[] {
  return REGIME_ORDER.map((id) => ({
    ...REGIME_DEFS[id],
    expectedDays: expectedDays(id),
  }));
}
