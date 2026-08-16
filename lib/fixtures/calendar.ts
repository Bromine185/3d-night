/**
 * NYSE trading calendar. Weekends plus the ten observed holidays, so the five
 * years of bars land on dates a real desk would recognise (~252 bars/year).
 */

const DAY_MS = 86_400_000;

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

/** Nth weekday of a month, e.g. nthWeekday(2026, 0, 1, 3) = 3rd Monday of January. */
function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = utc(year, month, 1);
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return utc(year, month, 1 + offset + (n - 1) * 7);
}

function lastWeekday(year: number, month: number, weekday: number): Date {
  const last = utc(year, month + 1, 0);
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return utc(year, month, last.getUTCDate() - offset);
}

/** Anonymous Gregorian algorithm. */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(year, month - 1, day);
}

/** Saturday holidays observe Friday, Sunday holidays observe Monday. */
function observed(d: Date): Date {
  const dow = d.getUTCDay();
  if (dow === 6) return new Date(d.getTime() - DAY_MS);
  if (dow === 0) return new Date(d.getTime() + DAY_MS);
  return d;
}

function holidaysFor(year: number): string[] {
  const fixed = [
    observed(utc(year, 0, 1)), // New Year's Day
    observed(utc(year, 5, 19)), // Juneteenth
    observed(utc(year, 6, 4)), // Independence Day
    observed(utc(year, 11, 25)), // Christmas
  ];
  const floating = [
    nthWeekday(year, 0, 1, 3), // MLK Jr. Day
    nthWeekday(year, 1, 1, 3), // Washington's Birthday
    new Date(easterSunday(year).getTime() - 2 * DAY_MS), // Good Friday
    lastWeekday(year, 4, 1), // Memorial Day
    nthWeekday(year, 8, 1, 1), // Labor Day
    nthWeekday(year, 10, 4, 4), // Thanksgiving
  ];
  return [...fixed, ...floating].map(iso);
}

/** Inclusive list of ISO trading days between two ISO dates. */
export function tradingDays(startIso: string, endIso: string): string[] {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);

  const closed = new Set<string>();
  for (let y = start.getUTCFullYear(); y <= end.getUTCFullYear(); y++) {
    for (const h of holidaysFor(y)) closed.add(h);
  }

  const days: string[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    const d = new Date(t);
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    const key = iso(d);
    if (closed.has(key)) continue;
    days.push(key);
  }
  return days;
}
