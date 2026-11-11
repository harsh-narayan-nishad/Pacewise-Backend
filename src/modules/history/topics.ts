/**
 * Topic analytics for one test attempt. Pure functions (no database), so the rules are unit-tested.
 *
 * Each attempt stores, per topic, how many questions there were and how many were answered correctly.
 * The level (strong / medium / weak) is always DERIVED from those counts, never stored or sent by the
 * client, so nobody can label a weak topic "strong" without the numbers backing it.
 */

/** Accuracy at or above this is "strong"; at or above MEDIUM_MIN is "medium"; below it is "weak". */
export const STRONG_MIN = 75;
export const MEDIUM_MIN = 50;
/** After a test, its topic labels can be edited for 2 days; then they are locked. */
export const EDIT_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

export type TopicLevel = "strong" | "medium" | "weak";
export interface TopicScore { topic: string; correct: number; total: number }
export interface TopicResult extends TopicScore { accuracy: number; level: TopicLevel }

export function accuracyOf(correct: number, total: number): number {
  return total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;
}

export function levelFor(correct: number, total: number): TopicLevel {
  const pct = total > 0 ? (correct / total) * 100 : 0;
  return pct >= STRONG_MIN ? "strong" : pct >= MEDIUM_MIN ? "medium" : "weak";
}

export function withLevel(t: TopicScore): TopicResult {
  return { topic: t.topic, correct: t.correct, total: t.total, accuracy: accuracyOf(t.correct, t.total), level: levelFor(t.correct, t.total) };
}

/** Trims names, drops empty ones and merges topics that differ only by case or spacing (first spelling wins). */
export function mergeTopics(list: TopicScore[]): TopicScore[] {
  const by = new Map<string, TopicScore>();
  for (const raw of list) {
    const name = raw.topic.replace(/\s+/g, " ").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const cur = by.get(key);
    if (cur) { cur.correct += raw.correct; cur.total += raw.total; }
    else by.set(key, { topic: name, correct: raw.correct, total: raw.total });
  }
  return [...by.values()];
}

/** The topic counts must add up to the test result, so topic labels can be changed but the score cannot be. */
export function topicsMatchResult(topics: TopicScore[], totalQuestions?: number | null, correctAnswers?: number | null): boolean {
  if (typeof totalQuestions !== "number" || typeof correctAnswers !== "number") return true; // a reading-only session has no test to match
  const total = topics.reduce((n, t) => n + t.total, 0);
  const correct = topics.reduce((n, t) => n + t.correct, 0);
  return total === totalQuestions && correct === correctAnswers;
}

export function editState(attemptedAt: Date, now: number = Date.now()) {
  const editableUntil = new Date(attemptedAt.getTime() + EDIT_WINDOW_MS);
  return { editableUntil, locked: now > editableUntil.getTime() };
}
