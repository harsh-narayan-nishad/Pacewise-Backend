/**
 * Pure rules for the generic sync endpoint (no database imports, so they
 * are unit-testable). The browser keeps its own business logic; this file
 * decides what the SERVER accepts and who may read what.
 */
export const COLLECTIONS = [
  "reactions",
  "comments",
  "commentReactions",
  "shares",
  "notifications",
  "saves",
  "playlists",
  "playlistRelationships",
  "follows",
  "avatars",
] as const;
export type Collection = (typeof COLLECTIONS)[number];

export const isCollection = (c: string): c is Collection => (COLLECTIONS as readonly string[]).includes(c);

type Data = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

/** The user a record belongs to — the only one (besides a notification's recipient) allowed to change or delete it. */
export function ownerOf(collection: Collection, id: string, data: Data): string | null {
  switch (collection) {
    case "reactions":
    case "comments":
    case "commentReactions":
    case "saves":
    case "playlists":
    case "playlistRelationships":
      return str(data.userId);
    case "shares":
      return str(data.senderId);
    case "follows":
      return str(data.followerId);
    case "notifications":
      return str(data.senderId);
    case "avatars":
      return id; // the avatar record's id IS the user's id
  }
}

/** Extra users who may read (and, for notifications, update) the record. */
export function audienceOf(collection: Collection, data: Data): string[] {
  if (collection === "notifications") return [str(data.recipientId)].filter((x): x is string => !!x);
  if (collection === "shares") return [str(data.receiverId)].filter((x): x is string => !!x);
  if (collection === "follows") return [str(data.followingId)].filter((x): x is string => !!x);
  return [];
}

/** Collections everyone signed in may read (it is social content). */
const PUBLIC_READ: ReadonlySet<Collection> = new Set(["reactions", "comments", "commentReactions", "follows", "avatars", "saves", "playlistRelationships"]);

export interface StoredRef { collection: string; ownerId: string; audience: string[]; data: Data }

export function canRead(rec: StoredRef, userId: string): boolean {
  if (!isCollection(rec.collection)) return false;
  if (rec.ownerId === userId || rec.audience.includes(userId)) return true;
  if (rec.collection === "playlists") return rec.data.isPublic === true;
  if (rec.collection === "saves") return false; // saved items are private
  return PUBLIC_READ.has(rec.collection);
}

export type Op = { op: "put"; collection: string; id: string; data: Data } | { op: "delete"; collection: string; id: string };

export type Verdict = { ok: true } | { ok: false; reason: string };

/** May `userId` apply `op`, given the record as it is stored now (or null)? */
export function authorize(userId: string, op: Op, existing: StoredRef | null): Verdict {
  if (!isCollection(op.collection)) return { ok: false, reason: "unknown collection" };
  const collection = op.collection;
  if (!op.id || op.id.length > 200) return { ok: false, reason: "bad id" };

  if (op.op === "delete") {
    if (!existing) return { ok: true }; // already gone
    if (existing.ownerId === userId) return { ok: true };
    if (collection === "notifications" && existing.audience.includes(userId)) return { ok: true };
    return { ok: false, reason: "not the owner" };
  }

  const owner = ownerOf(collection, op.id, op.data);
  if (!owner) return { ok: false, reason: "missing owner field" };

  if (existing) {
    // Updating: owner can; a notification's recipient may update it (mark read) but not change who it is for.
    if (existing.ownerId === userId && owner === userId) return { ok: true };
    if (collection === "notifications" && existing.audience.includes(userId) && owner === existing.ownerId) return { ok: true };
    return { ok: false, reason: "not the owner" };
  }
  // Creating: you may only create records that belong to you (a notification's sender is you).
  if (owner !== userId) return { ok: false, reason: "cannot create records for another user" };
  return { ok: true };
}
