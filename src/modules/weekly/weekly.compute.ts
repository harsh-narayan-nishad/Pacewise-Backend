/** Weekly progress report numbers. Pure functions (no database) so the maths is unit-tested. Days are UTC calendar days. */
import { mergeTopics, withLevel, type TopicResult, type TopicScore } from "@/modules/history/topics";

export interface SessionLite { createdAt: Date; wpm?: number | null; minutes?: number | null; accuracy?: number | null; totalQuestions?: number | null; correctAnswers?: number | null; topics?: TopicScore[] | null }
export interface ActivityLite { day: string; readMs?: number | null; testsTaken?: number | null }

export interface WeeklyReport {
  range: { from: string; to: string };
  days: { day: string; label: string; minutes: number; active: boolean }[];
  sessions: number; minutes: number;
  avgWpm: number | null; bestWpm: number | null; wpmDelta: number | null;
  testsTaken: number; avgAccuracy: number | null; accuracyDelta: number | null;
  activeDays: number; streak: number; consistencyPercent: number;
  topics: { strong: TopicResult[]; medium: TopicResult[]; weak: TopicResult[] };
  focus: string | null;
  headline: string;
}

export const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const DAY_MS = 86_400_000;
const LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The n days ending at `endDay` (inclusive), oldest first. */
export function lastDays(endDay: string, n: number): string[] {
  const end = Date.parse(`${endDay}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => dayKey(new Date(end - (n - 1 - i) * DAY_MS)));
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);
const delta = (cur: number | null, prev: number | null) => (cur === null || prev === null ? null : round1(cur - prev));

function stats(sessions: SessionLite[]) {
  const wpms = sessions.map((s) => s.wpm ?? 0).filter((n) => n > 0);
  const accs = sessions.filter((s) => (s.totalQuestions ?? 0) > 0 && typeof s.accuracy === "number").map((s) => s.accuracy as number);
  return { avgWpm: mean(wpms), bestWpm: wpms.length ? Math.max(...wpms) : null, avgAcc: mean(accs), tests: sessions.filter((s) => (s.totalQuestions ?? 0) > 0).length };
}

export function buildWeeklyReport(input: { endDay: string; sessions: SessionLite[]; prevSessions: SessionLite[]; activity: ActivityLite[] }): WeeklyReport {
  const days = lastDays(input.endDay, 7);
  const inWeek = new Set(days);
  const sessions = input.sessions.filter((s) => inWeek.has(dayKey(s.createdAt)));
  const activityBy = new Map(input.activity.filter((a) => inWeek.has(a.day)).map((a) => [a.day, a]));

  const perDay = days.map((day) => {
    const act = activityBy.get(day);
    const ofDay = sessions.filter((s) => dayKey(s.createdAt) === day);
    const fromActivity = Math.round((act?.readMs ?? 0) / 60_000);
    const minutes = fromActivity > 0 ? fromActivity : ofDay.reduce((n, s) => n + (s.minutes ?? 0), 0);
    const active = minutes > 0 || (act?.testsTaken ?? 0) > 0 || ofDay.length > 0;
    return { day, label: LABELS[new Date(`${day}T00:00:00Z`).getUTCDay()], minutes, active };
  });

  const activeDays = perDay.filter((d) => d.active).length;
  // Streak: consecutive active days counted back from the last day (if that day is still empty, from the day before).
  let i = perDay.length - 1;
  if (!perDay[i].active) i -= 1;
  let streak = 0;
  while (i >= 0 && perDay[i].active) { streak += 1; i -= 1; }

  const cur = stats(sessions), prev = stats(input.prevSessions);
  const merged = mergeTopics(sessions.flatMap((s) => s.topics ?? [])).map(withLevel);
  const topics = {
    strong: merged.filter((t) => t.level === "strong").sort((a, b) => b.accuracy - a.accuracy),
    medium: merged.filter((t) => t.level === "medium").sort((a, b) => b.accuracy - a.accuracy),
    weak: merged.filter((t) => t.level === "weak").sort((a, b) => a.accuracy - b.accuracy),
  };
  const weakest = topics.weak[0] ?? topics.medium[topics.medium.length - 1] ?? null;
  const focus = weakest ? `Focus next on ${weakest.topic} (${weakest.accuracy}% this week).` : null;

  const wpmDelta = delta(round1(cur.avgWpm), round1(prev.avgWpm));
  const headline = activeDays === 0
    ? "A quiet week. A few minutes a day is enough to keep your pace."
    : `You practised on ${activeDays} of 7 days${wpmDelta === null ? "" : `, and your reading speed is ${wpmDelta >= 0 ? "up" : "down"} ${Math.abs(wpmDelta)} WPM on last week`}.`;

  return {
    range: { from: days[0], to: days[6] }, days: perDay,
    sessions: sessions.length, minutes: perDay.reduce((n, d) => n + d.minutes, 0),
    avgWpm: cur.avgWpm === null ? null : Math.round(cur.avgWpm), bestWpm: cur.bestWpm, wpmDelta,
    testsTaken: Math.max(cur.tests, perDay.reduce((n, d) => n + (activityBy.get(d.day)?.testsTaken ?? 0), 0)),
    avgAccuracy: round1(cur.avgAcc), accuracyDelta: delta(round1(cur.avgAcc), round1(prev.avgAcc)),
    activeDays, streak, consistencyPercent: Math.round((activeDays / 7) * 100),
    topics, focus, headline,
  };
}
