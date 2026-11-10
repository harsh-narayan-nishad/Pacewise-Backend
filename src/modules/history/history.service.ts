import { ReadingSession, Story } from "@/models";

export async function recordSession(userId: string, data: Record<string, unknown>) {
  return (await ReadingSession.create({ ...data, userId })).toJSON();
}

export async function listSessions(userId: string, page: number, pageSize: number) {
  const [rows, total] = await Promise.all([
    ReadingSession.find({ userId }).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    ReadingSession.countDocuments({ userId }),
  ]);
  const ids = [...new Set(rows.map((r) => r.storyId).filter(Boolean) as string[])];
  const stories = await Story.find({ _id: { $in: ids } }).select("title").lean();
  const by = new Map(stories.map((s) => [s._id, { id: s._id, title: s.title }]));
  return { items: rows.map(({ _id, ...r }) => ({ id: _id, ...r, story: r.storyId ? by.get(r.storyId) ?? null : null })), total, page, pageSize };
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
