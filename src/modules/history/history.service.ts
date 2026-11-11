import { DailyActivity, ReadingSession, Story } from "@/models";
import { AppError, NotFoundError } from "@/utils/AppError";
import { editState, mergeTopics, topicsMatchResult, withLevel, type TopicScore } from "@/modules/history/topics";

/** Adds the derived level to each topic and says until when the labels can still be edited. */
function topicView(row: { topics?: TopicScore[] | null; createdAt?: Date; topicsEditedAt?: Date | null }) {
  const topics = (row.topics ?? []).map((t) => withLevel({ topic: t.topic, correct: t.correct, total: t.total }));
  const { editableUntil, locked } = editState(row.createdAt ?? new Date());
  return { topics, topicsEditableUntil: editableUntil, topicsLocked: locked, topicsEditedAt: row.topicsEditedAt ?? null };
}

export async function recordSession(userId: string, data: Record<string, unknown>) {
  const topics = data.topics ? mergeTopics(data.topics as TopicScore[]) : undefined;
  if (topics && !topicsMatchResult(topics, data.totalQuestions as number | undefined, data.correctAnswers as number | undefined)) {
    throw new AppError(400, "Topic totals must match the test result.", "TOPICS_MISMATCH");
  }
  const row = await ReadingSession.create({ ...data, ...(topics ? { topics } : {}), userId });
  const json = row.toJSON() as Record<string, unknown>;
  return { ...json, ...topicView(row) };
}

/** Edit the topic labels of one attempt. Allowed for 2 days after the attempt; the score itself can never change. */
export async function updateTopics(userId: string, sessionId: string, incoming: TopicScore[]) {
  const row = await ReadingSession.findOne({ _id: sessionId, userId });
  if (!row) throw new NotFoundError("Attempt not found");
  if (editState(row.createdAt as Date).locked) throw new AppError(403, "Topics can only be edited within 2 days of the test.", "TOPICS_LOCKED");
  const topics = mergeTopics(incoming);
  if (!topics.length) throw new AppError(400, "Add at least one topic.", "TOPICS_EMPTY");
  if (!topicsMatchResult(topics, row.totalQuestions, row.correctAnswers)) throw new AppError(400, "Topic totals must match the test result.", "TOPICS_MISMATCH");
  row.set("topics", topics);
  row.set("topicsEditedAt", new Date());
  await row.save();
  return { id: row._id, ...topicView(row) };
}

export async function listSessions(userId: string, page: number, pageSize: number) {
  const [rows, total] = await Promise.all([
    ReadingSession.find({ userId }).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    ReadingSession.countDocuments({ userId }),
  ]);
  const ids = [...new Set(rows.map((r) => r.storyId).filter(Boolean) as string[])];
  const stories = await Story.find({ _id: { $in: ids } }).select("title").lean();
  const by = new Map(stories.map((s) => [s._id, { id: s._id, title: s.title }]));
  return { items: rows.map(({ _id, ...r }) => ({ id: _id, ...r, ...topicView(r), story: r.storyId ? by.get(r.storyId) ?? null : null, title: r.title ?? (r.storyId ? by.get(r.storyId)?.title : undefined) ?? "Reading session" })), total, page, pageSize };
}

export async function getStats(userId: string) {
  const [agg] = await ReadingSession.aggregate([
    { $match: { userId } },
    { $group: { _id: null, n: { $sum: 1 }, avgWpm: { $avg: "$wpm" }, bestWpm: { $max: "$wpm" }, avgAcc: { $avg: "$accuracy" }, minutes: { $sum: "$minutes" } } },
  ]);
  return {
    sessionCount: agg?.n ?? 0,
    averageWpm: agg?.avgWpm ?? 0,
    bestWpm: agg?.bestWpm ?? 0,
    averageAccuracy: agg?.avgAcc ?? null,
    totalMinutes: agg?.minutes ?? 0,
  };
}

/** The numbers behind the landing page's "Performance that stands out": best speeds, best quiz scores, and active days per week. */
export async function getHighlights(userId: string, today?: string) {
  const label = (r: { title?: string | null; storyId?: string | null }) => r.title ?? "Reading session";
  const [fast, sharp, days] = await Promise.all([
    ReadingSession.find({ userId, wpm: { $gt: 0 } }).sort({ wpm: -1 }).limit(4).select("title storyId wpm").lean(),
    ReadingSession.find({ userId, accuracy: { $gt: 0 } }).sort({ accuracy: -1, createdAt: -1 }).limit(4).select("title storyId accuracy").lean(),
    DailyActivity.find({ userId, readMs: { $gt: 0 } }).select("day").lean(),
  ]);
  const active = new Set(days.map((d) => d.day));
  const base = today && /^\d{4}-\d{2}-\d{2}$/.test(today) ? new Date(`${today}T00:00:00Z`) : new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const weeks = [0, 1, 2, 3].map((w) => {
    let n = 0;
    for (let d = 0; d < 7; d += 1) {
      const t = new Date(base);
      t.setUTCDate(base.getUTCDate() - w * 7 - d);
      if (active.has(t.toISOString().slice(0, 10))) n += 1;
    }
    return { weeksAgo: w, activeDays: n };
  });
  return {
    speed: fast.map((r) => ({ title: label(r), wpm: r.wpm })),
    comprehension: sharp.map((r) => ({ title: label(r), accuracy: r.accuracy })),
    consistency: weeks,
  };
}
