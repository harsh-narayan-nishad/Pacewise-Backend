import { Follow, Story, User } from "@/models";
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
