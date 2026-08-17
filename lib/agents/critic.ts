/**
 * The critic. Reads a running journal of the user's decisions and names the
 * recurring mistake. The journal is a seeded fixture in v1 — fourteen entries
 * over seven months, written the way a PM actually writes at 11pm. The
 * diagnosis cites the two or three decisions that triggered it, and flags the
 * regions of parameter space the user keeps crawling back to, which is where
 * the /explore ghost whispers.
 */
import { DATES, LATEST_INDEX } from "../fixtures";
import { overnight } from "./clock";
import type { CriticOutput, FlaggedRegion, JournalEntry, TrendPoint } from "./types";

/**
 * The journal. Dates sit on real sessions in the fixture window. `sizeR` is
 * risk units; `outcome` is what the decision realised. The pattern planted
 * here — sizing follows the last outcome, not the signal — is the one the
 * critic names.
 */
export const JOURNAL: JournalEntry[] = [
  {
    date: "2026-01-13",
    symbol: "SRPT",
    action: "add",
    sizeR: 1.0,
    note: "Standard fade on the readout gap. Plan says 6 days, stop 8%. Boring is good.",
    params: { minGap: 0.05, holdingDays: 6 },
    outcome: 0.041,
  },
  {
    date: "2026-01-21",
    symbol: "CRSP",
    action: "add",
    sizeR: 1.8,
    note: "Last one worked, this setup looks identical but cleaner. Went bigger.",
    params: { minGap: 0.05, holdingDays: 6 },
    outcome: 0.028,
  },
  {
    date: "2026-02-03",
    symbol: "IONS",
    action: "add",
    sizeR: 2.5,
    note: "Three in a row. The desk is printing. Doubled the usual unit, tightened hold to 2 days to recycle capital faster.",
    params: { minGap: 0.04, holdingDays: 2 },
    outcome: -0.062,
  },
  {
    date: "2026-02-04",
    symbol: "IONS",
    action: "cut",
    sizeR: 0,
    note: "Down a day, cut it. Not letting a winner streak die on one name.",
    params: { minGap: 0.04, holdingDays: 2 },
    outcome: -0.019,
  },
  {
    date: "2026-02-24",
    symbol: "ARWR",
    action: "skip",
    sizeR: 0,
    note: "Textbook setup but still annoyed about IONS. Passed. Watched it fade 9% without me.",
    outcome: 0,
  },
  {
    date: "2026-03-17",
    symbol: "SRPT",
    action: "add",
    sizeR: 0.5,
    note: "Half size until I feel it again.",
    params: { minGap: 0.06, holdingDays: 6 },
    outcome: 0.055,
  },
  {
    date: "2026-04-01",
    symbol: "CRSP",
    action: "add",
    sizeR: 1.6,
    note: "Feeling it again. Size back up, hold short — two days, in and out.",
    params: { minGap: 0.03, holdingDays: 2 },
    outcome: -0.034,
  },
  {
    date: "2026-04-02",
    symbol: "CRSP",
    action: "cut",
    sizeR: 0,
    note: "Cut at day one again. It reversed the day after I flattened. Of course it did.",
    params: { minGap: 0.03, holdingDays: 2 },
    outcome: -0.011,
  },
  {
    date: "2026-05-11",
    symbol: "VIX",
    action: "skip",
    sizeR: 0,
    note: "Vol bid, tape heavy. Sat out the week. Right call for wrong reasons probably.",
    outcome: 0,
  },
  {
    date: "2026-06-08",
    symbol: "IONS",
    action: "add",
    sizeR: 1.0,
    note: "Back to plan size, plan hold. Wrote the checklist on a post-it this time.",
    params: { minGap: 0.05, holdingDays: 6 },
    outcome: 0.047,
  },
  {
    date: "2026-06-22",
    symbol: "SRPT",
    action: "add",
    sizeR: 2.2,
    note: "Two greens. Sized up again — I know, but the calendar is dense and the edge decays.",
    params: { minGap: 0.04, holdingDays: 3 },
    outcome: -0.055,
  },
  {
    date: "2026-07-06",
    symbol: "ARWR",
    action: "flip",
    sizeR: 1.2,
    note: "Flipped the fade to momentum mid-trade after a headline. Neither leg worked.",
    params: { minGap: 0.04, holdingDays: 3 },
    outcome: -0.043,
  },
  {
    date: "2026-07-27",
    symbol: "CRSP",
    action: "add",
    sizeR: 0.5,
    note: "Half size. Again. The oscillation itself is the position now.",
    params: { minGap: 0.06, holdingDays: 6 },
    outcome: 0.036,
  },
  {
    date: "2026-08-10",
    symbol: "SRPT",
    action: "add",
    sizeR: 1.9,
    note: "Green last week so I'm big this week. Writing that sentence didn't stop me.",
    params: { minGap: 0.04, holdingDays: 2 },
    outcome: -0.021,
  },
];

/** Entries where size moved with the last outcome instead of the signal. */
const TRIGGER_DATES = ["2026-02-03", "2026-06-22", "2026-08-10"];

export const FLAGGED_REGIONS: FlaggedRegion[] = [
  {
    minGap: [0.03, 0.045],
    holdingDays: [1, 3],
    whisper:
      "You've been here three times — short holds, thin gaps, always sized up after a green streak. It cost 1.4R each visit.",
    evidence: ["2026-02-03", "2026-04-01", "2026-08-10"],
  },
  {
    minGap: [0.055, 0.07],
    holdingDays: [5, 7],
    whisper:
      "This is where the plan lives. Every half-sized apology trade you placed here worked. You leave it when you're winning.",
    evidence: ["2026-03-17", "2026-06-08", "2026-07-27"],
  },
];

let cached: CriticOutput | null = null;

export function runCritic(): CriticOutput {
  if (cached) return cached;

  // Mistake pressure over time: |sizeR - 1| for sized entries, monthly-ish.
  const drift: TrendPoint[] = JOURNAL.filter((j) => j.action === "add" || j.action === "flip").map(
    (j) => ({ date: j.date, value: Math.round(Math.abs(j.sizeR - 1) * 100) / 100 }),
  );

  const evidence = JOURNAL.filter((j) => TRIGGER_DATES.includes(j.date));

  cached = {
    agent: "critic",
    timestamp: overnight(281), // 04:41 — reads the journal last, when it's quiet
    asset: "JOURNAL",
    horizon: "cycle",
    trend_context: drift,
    pattern: "Size follows mood, not signal",
    diagnosis:
      "The strategy has an edge and you keep renting it out to your emotional state. After two green trades you size up 1.8–2.5R and shorten the hold — the exact opposite of what the fade needs, which is time. After a red trade you halve size on the next valid setup, so the wins that follow are small and the losses that precede are large. Across seven months the plan-sized, plan-length entries are +4.5% per trade on average; the streak-sized ones are −4.6%. The market hasn't been beating you. The sequencing of your own conviction has.",
    evidence,
    journal: JOURNAL,
    flaggedRegions: FLAGGED_REGIONS,
  };
  return cached;
}

/** True if `date` (ISO) sits in the fixture window — journal sanity check. */
export function inWindow(date: string): boolean {
  return date >= DATES[0] && date <= DATES[LATEST_INDEX];
}
