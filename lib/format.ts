/** Number and date formatting for the desk. Signs are explicit; en-dashes for zero. */

export function fmtPct(x: number, digits = 1): string {
  const v = x * 100;
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(digits)}%`;
}

/** Percent without a forced sign — for magnitudes like win rate or exposure. */
export function fmtPctAbs(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`;
}

export function fmtNum(x: number, digits = 2): string {
  const sign = x > 0 ? "+" : "";
  return `${sign}${x.toFixed(digits)}`;
}

export function fmtPrice(x: number): string {
  return x >= 100 ? x.toFixed(2) : x.toFixed(2);
}

/** "2026-08-14" → "Aug 14". */
export function fmtDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** "2026-08-14" → "Aug 14 ’26". */
export function fmtDateYear(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  const s = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${s} ’${iso.slice(2, 4)}`;
}

/** ISO datetime → "02:31" in the timestamp's own offset. */
export function fmtClock(iso: string): string {
  const m = iso.match(/T(\d{2}:\d{2})/);
  return m ? m[1] : iso;
}

export function fmtR(x: number): string {
  return `${x.toFixed(1)}R`;
}
