import mongoose, { Schema } from "mongoose";
import { DailyActivity, ItemTime, UserBlob } from "@/models";
import { computeConsistency } from "@/modules/tracking/consistency";

/** Remembers applied event ids for a week so a retried batch never double-counts. */
const AppliedOp = mongoose.model(
  "AppliedOp",
  new Schema({ _id: String, at: { type: Date, default: Date.now, index: { expireAfterSeconds: 7 * 86_400 } } }, { versionKey: false })
);

type TimeEvent = { type: "time"; opId: string; day: string; kind: "story" | "doc" | "reader"; itemId: string; title?: string; ms: number; opened?: boolean; at?: string };
type CountEvent = { type: "count"; opId: string; day: string; field: "testsTaken" | "storiesRead" | "docsRead"; inc: number };
export type TrackingEvent = TimeEvent | CountEvent;

async function firstTime(userId: string, opId: string): Promise<boolean> {
  try {
    await AppliedOp.create({ _id: `${userId}:${opId}` });
    return true;
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return false;
    throw e;
  }
}

const KIND_FIELD = { story: "storyMs", doc: "docMs", reader: "readerMs" } as const;

export async function recordEvents(userId: string, events: TrackingEvent[]) {
  let applied = 0;
  let duplicates = 0;
  for (const e of events) {
    if (!(await firstTime(userId, e.opId))) { duplicates += 1; continue; }
    if (e.type === "time") {
      await DailyActivity.updateOne({ userId, day: e.day }, { $inc: { readMs: e.ms, [KIND_FIELD[e.kind]]: e.ms } }, { upsert: true });
      await ItemTime.updateOne(
        { userId, kind: e.kind, itemId: e.itemId },
        { $inc: { totalMs: e.ms, opens: e.opened ? 1 : 0 }, $set: { lastReadAt: e.at ? new Date(e.at) : new Date(), ...(e.title ? { title: e.title } : {}) } },
        { upsert: true }
      );
    } else {
      await DailyActivity.updateOne({ userId, day: e.day }, { $inc: { [e.field]: e.inc } }, { upsert: true });
    }
    applied += 1;
  }
  return { applied, duplicates };
}

export async function getSummary(userId: string, today: string, minActiveMs?: number) {
  const days = await DailyActivity.find({ userId }).sort({ day: -1 }).limit(800).lean();
  const consistency = computeConsistency(days.map((d) => ({ day: d.day, readMs: d.readMs })), today, minActiveMs);
  const totals = days.reduce(
    (a, d) => ({ storyMs: a.storyMs + d.storyMs, docMs: a.docMs + d.docMs, readerMs: a.readerMs + d.readerMs, testsTaken: a.testsTaken + d.testsTaken, storiesRead: a.storiesRead + d.storiesRead, docsRead: a.docsRead + d.docsRead }),
    { storyMs: 0, docMs: 0, readerMs: 0, testsTaken: 0, storiesRead: 0, docsRead: 0 }
  );
  return { ...consistency, ...totals };
}

export async function getState(userId: string, today: string) {
  const [blobs, days, items] = await Promise.all([
    UserBlob.find({ userId }).lean(),
    DailyActivity.find({ userId }).sort({ day: -1 }).limit(400).lean(),
    ItemTime.find({ userId }).sort({ lastReadAt: -1 }).limit(500).lean(),
  ]);
  return {
    blobs: Object.fromEntries(blobs.map((b) => [b.key as string, { value: b.value, rev: b.rev }])),
    daily: days.map(({ _id, userId: _u, ...d }) => d),
    items: items.map(({ _id, userId: _u, ...i }) => i),
    summary: await getSummary(userId, today),
  };
}

/** Last-write-wins blob with a revision counter (history list, bookmarks, achievements ...). */
export async function putBlob(userId: string, key: string, value: unknown) {
  const _id = `${userId}:${key}`;
  const doc = await UserBlob.findOneAndUpdate({ _id }, { $set: { userId, key, value }, $inc: { rev: 1 } }, { upsert: true, new: true });
  return { key, rev: doc.rev };
}
