/**
 * Pure streak/consistency maths (no database imports → unit-testable).
 * Days are calendar-day strings "YYYY-MM-DD" in the USER's own time zone
 * (the browser decides what "today" is and sends it), so a streak never
 * breaks just because the server runs in another time zone.
 */
export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const toUtcMs = (day: string): number => {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
export const dayDiff = (a: string, b: string): number => Math.round((toUtcMs(b) - toUtcMs(a)) / 86_400_000);
export function addDays(day: string, n: number): string {
  return new Date(toUtcMs(day) + n * 86_400_000).toISOString().slice(0, 10);
}

export interface DayRow { day: string; readMs: number }
export interface Consistency {
  currentStreak: number;
  longestStreak: number;
  activeDays: number;
  totalMs: number;
  last7Days: { day: string; readMs: number; active: boolean }[];
  last30ActiveDays: number;
  todayActive: boolean;
}

/** A day counts when the user read at least `minActiveMs` (default 1 minute). */
export function computeConsistency(rows: DayRow[], today: string, minActiveMs = 60_000): Consistency {
  const ms = new Map<string, number>();
  for (const r of rows) if (DAY_RE.test(r.day)) ms.set(r.day, (ms.get(r.day) ?? 0) + Math.max(0, r.readMs));
  const active = [...ms.entries()].filter(([, v]) => v >= minActiveMs).map(([d]) => d).sort();
  const set = new Set(active);

  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of active) {
    run = prev !== null && dayDiff(prev, d) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }

  // Current streak: counts back from today; if today has no reading YET the streak is still alive from yesterday.
  let cursor = set.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (set.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i - 6);
    const readMs = ms.get(day) ?? 0;
    return { day, readMs, active: readMs >= minActiveMs };
  });
  const from30 = addDays(today, -29);
  return {
    currentStreak: current,
    longestStreak: longest,
    activeDays: active.length,
    totalMs: [...ms.values()].reduce((a, b) => a + b, 0),
    last7Days,
    last30ActiveDays: active.filter((d) => d >= from30 && d <= today).length,
    todayActive: set.has(today),
  };
}
