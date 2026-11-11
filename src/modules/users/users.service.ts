import { Follow, Story, SyncRecord, User } from "@/models";
import { ConflictError, NotFoundError } from "@/utils/AppError";
import { publishEvent } from "@/modules/notifications/notifications.service";

export async function getPublicProfile(username: string) {
  const user = await User.findOne({ username }).lean();
  if (!user) throw new NotFoundError("User");
  const [followedBy, following, stories] = await Promise.all([
    Follow.countDocuments({ followingId: user._id }),
    Follow.countDocuments({ followerId: user._id }),
    Story.countDocuments({ authorId: user._id }),
  ]);
  return {
    id: user._id,
    username: user.username,
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
    interests: user.interests,
    createdAt: user.createdAt,
    _count: { followedBy, following, stories },
  };
}

export async function updateProfile(userId: string, patch: { name?: string; interests?: string[]; avatarUrl?: string }) {
  const u = await User.findByIdAndUpdate(userId, patch, { new: true }).lean();
  if (!u) throw new NotFoundError("User");
  return { id: u._id, email: u.email, username: u.username, name: u.name, interests: u.interests, avatarUrl: u.avatarUrl ?? null };
}

export async function follow(followerId: string, followingUsername: string) {
  const target = await User.findOne({ username: followingUsername }).lean();
  if (!target) throw new NotFoundError("User");
  if (target._id === followerId) throw new ConflictError("Can't follow yourself");

  const res = await Follow.updateOne({ followerId, followingId: target._id }, { $setOnInsert: { followerId, followingId: target._id } }, { upsert: true });
  if (res.upsertedCount === 0) return { alreadyFollowing: true };

  const follower = await User.findById(followerId).lean();
  await publishEvent({ recipientId: target._id, senderId: followerId, type: "FOLLOW", message: `${follower?.name ?? "Someone"} started following you` });
  return { alreadyFollowing: false };
}

export async function unfollow(followerId: string, followingUsername: string) {
  const target = await User.findOne({ username: followingUsername }).lean();
  if (!target) throw new NotFoundError("User");
  await Follow.deleteMany({ followerId, followingId: target._id });
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  return (await Follow.exists({ followerId, followingId })) !== null;
}

/** Everyone who has an account (public fields only), so the app can show real people in follow / share lists. */
export async function listDirectory(updatedSince?: string) {
  // Banned / unapproved accounts are not shown to other people.
  const where = { status: { $nin: ["pending", "rejected", "banned"] }, ...(updatedSince ? { updatedAt: { $gt: new Date(updatedSince) } } : {}) };
  const rows = await User.find(where).select("username name interests avatarUrl isDemoUser updatedAt").sort({ updatedAt: 1 }).limit(2000).lean();
  return rows.map((u) => ({ id: u._id, username: u.username, name: u.name, interests: u.interests, isDemoUser: u.isDemoUser ?? false, updatedAt: u.updatedAt }));
}

/**
 * Who follows a person ("followers") or who they follow ("following"), newest first, public fields only.
 * Follows made in the app are stored as synced records; follows made through the follow endpoints are in
 * the Follow collection. Both are read and merged, so nobody is missing from the list.
 */
export async function listRelations(userId: string, kind: "followers" | "following", page: number, pageSize: number) {
  const mineField = kind === "followers" ? "followingId" : "followerId";
  const otherField = kind === "followers" ? "followerId" : "followingId";
  const [synced, legacy] = await Promise.all([
    SyncRecord.find({ coll: "follows", deleted: false, [`data.${mineField}`]: userId }).sort({ seq: -1 }).limit(5000).select("data").lean(),
    Follow.find({ [mineField]: userId }).sort({ createdAt: -1 }).limit(5000).lean(),
  ]);
  const order: string[] = [];
  const seen = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v === "string" && v && v !== userId && !seen.has(v)) { seen.add(v); order.push(v); }
  };
  for (const r of synced) add((r.data as Record<string, unknown>)[otherField]);
  for (const l of legacy) add((l as unknown as Record<string, unknown>)[otherField]);

  // Accounts that are banned or not approved are not shown to other people.
  const rows = await User.find({ _id: { $in: order }, status: { $nin: ["pending", "rejected", "banned"] } }).select("username name avatarUrl").lean();
  const by = new Map(rows.map((u) => [u._id as string, u]));
  const people = order.filter((id) => by.has(id)).map((id) => {
    const u = by.get(id)!;
    return { id, username: u.username, name: u.name, avatarUrl: (u as { avatarUrl?: string }).avatarUrl ?? null };
  });
  return { items: people.slice((page - 1) * pageSize, page * pageSize), total: people.length, page, pageSize };
}
