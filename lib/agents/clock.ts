/**
 * The overnight run happens between the last close in the fixtures and the
 * next session's open. Every agent timestamp lands in that window, so the
 * timeline's "last eight hours" zoom has a real night to show.
 */
import { LATEST_DATE } from "../fixtures";
import { tradingDays } from "../fixtures/calendar";

/** The session the desk wakes up to — first trading day after the last bar. */
export const RUN_DATE: string = (() => {
  const horizon = new Date(`${LATEST_DATE}T00:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + 10);
  const days = tradingDays(LATEST_DATE, horizon.toISOString().slice(0, 10));
  return days[1] ?? LATEST_DATE;
})();

/** ISO timestamp `minutes` past midnight ET on the run date. */
export function overnight(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  const s = Math.round((minutes % 1) * 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${RUN_DATE}T${pad(h)}:${pad(m)}:${pad(s)}-04:00`;
}
