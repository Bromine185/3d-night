/**
 * The five overnight agents. Pure functions over the fixtures — no I/O, no
 * randomness outside the seeded streams, same output every run. Both surfaces
 * import from here and only here.
 */
export * from "./types";
export { RUN_DATE, overnight } from "./clock";

export { SENTENCE, STRATEGY, runCoder } from "./coder";
export {
  SURFACE_AXES,
  backtestSummary,
  candidateEvents,
  computeSurface,
  runBacktest,
} from "./backtester";
export {
  PERSONAS,
  dispersionAt,
  personaSignal,
  personaView,
  personasSummary,
  runPersonas,
  signalsAt,
} from "./personas";
export { STORM_OPTS, runBreaker, stressSpecs, worstWindows } from "./breaker";
export { FLAGGED_REGIONS, JOURNAL, runCritic } from "./critic";
