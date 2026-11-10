import { SyncRecord, nextSeq } from "@/models";
import { Op, StoredRef, audienceOf, authorize, canRead, isCollection, ownerOf } from "@/modules/sync/policy";

export interface OpResult { applied: number; rejected: { index: number; reason: string }[]; seq: number }

const keyOf = (collection: string, id: string) => `${collection}:${id}`;

export async function applyOps(userId: string, ops: Op[]): Promise<OpResult> {
  let applied = 0;
  const rejected: OpResult["rejected"] = [];
  let seq = 0;

  for (let i = 0; i < ops.length; i += 1) {
    const op = ops[i];
    const _id = keyOf(op.collection, op.id);
    const row = await SyncRecord.findById(_id).lean();
    const existing: StoredRef | null = row
      ? { collection: row.coll, ownerId: row.ownerId, audience: row.audience, data: row.data as Record<string, unknown> }
      : null;
    // A tombstoned record counts as "does not exist" for creation rules.
    const live = row && !row.deleted ? existing : null;
    const verdict = authorize(userId, op, row?.deleted ? null : live);
    if (!verdict.ok) { rejected.push({ index: i, reason: verdict.reason }); continue; }

    seq = await nextSeq();
    if (op.op === "delete") {
      if (row) await SyncRecord.updateOne({ _id }, { $set: { deleted: true, seq } });
      else await SyncRecord.create({ _id, coll: op.collection, recordId: op.id, ownerId: userId, data: {}, deleted: true, seq });
    } else {
      const ownerId = ownerOf(op.collection as never, op.id, op.data) as string;
      await SyncRecord.updateOne(
        { _id },
        { $set: { coll: op.collection, recordId: op.id, ownerId, audience: audienceOf(op.collection as never, op.data), data: op.data, deleted: false, seq } },
        { upsert: true }
      );
    }
    applied += 1;
  }
  return { applied, rejected, seq: seq || (await currentSeq()) };
}

async function currentSeq(): Promise<number> {
  const last = await SyncRecord.findOne().sort({ seq: -1 }).select("seq").lean();
  return last?.seq ?? 0;
}

export interface Snapshot {
  seq: number;
  upserts: Record<string, Record<string, unknown>[]>;
  deletes: Record<string, string[]>;
}

/** Everything the user may see that changed after `since` (0 = full snapshot). */
export async function snapshot(userId: string, since: number): Promise<Snapshot> {
  const rows = await SyncRecord.find({
    seq: { $gt: since },
    $or: [{ ownerId: userId }, { audience: userId }, { coll: { $in: ["reactions", "comments", "commentReactions", "follows", "avatars", "playlistRelationships"] } }, { coll: "playlists", "data.isPublic": true }],
  })
    .sort({ seq: 1 })
    .limit(20_000)
    .lean();

  const out: Snapshot = { seq: since, upserts: {}, deletes: {} };
  for (const r of rows) {
    out.seq = Math.max(out.seq, r.seq);
    if (!isCollection(r.coll)) continue;
    if (r.deleted) {
      (out.deletes[r.coll] ??= []).push(r.recordId);
      continue;
    }
    if (!canRead({ collection: r.coll, ownerId: r.ownerId, audience: r.audience, data: r.data as Record<string, unknown> }, userId)) continue;
    (out.upserts[r.coll] ??= []).push(r.data as Record<string, unknown>);
  }
  return out;
}
