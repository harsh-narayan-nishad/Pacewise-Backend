import { Bookmark, Comment, Reaction, Share, Story, User } from "@/models";
import { NotFoundError } from "@/utils/AppError";
import { publishEvent } from "@/modules/notifications/notifications.service";

type ReactionType = "LIKE" | "DISLIKE";

async function storyAuthorId(storyId: string): Promise<string> {
  const story = await Story.findById(storyId).select("authorId").lean();
  if (!story) throw new NotFoundError("Story");
  return story.authorId;
}
const nameOf = async (id: string) => (await User.findById(id).select("name").lean())?.name ?? "Someone";
const authorShape = (u: { username: string; name: string; avatarUrl?: string | null } | null) =>
  u ? { username: u.username, name: u.name, avatarUrl: u.avatarUrl ?? null } : null;

/** One row per (story,user); like replaces dislike. Only a NEW like notifies. */
export async function setReaction(userId: string, storyId: string, type: ReactionType) {
  const authorId = await storyAuthorId(storyId);
  const prev = await Reaction.findOneAndUpdate({ storyId, userId }, { $set: { type } }, { upsert: true, new: false });
  const reaction = await Reaction.findOne({ storyId, userId });
  if (type === "LIKE" && prev?.type !== "LIKE") {
    await publishEvent({ recipientId: authorId, senderId: userId, type: "LIKE", message: `${await nameOf(userId)} liked your story`, storyId });
  }
  return reaction?.toJSON();
}

export async function clearReaction(userId: string, storyId: string): Promise<void> {
  await Reaction.deleteMany({ storyId, userId });
}

export async function addComment(userId: string, storyId: string, text: string) {
  const authorId = await storyAuthorId(storyId);
  const c = await Comment.create({ storyId, userId, text });
  const user = await User.findById(userId).select("username name avatarUrl").lean();
  await publishEvent({ recipientId: authorId, senderId: userId, type: "COMMENT", message: `${user?.name ?? "Someone"} commented on your story`, storyId });
  return { ...c.toJSON(), user: authorShape(user) };
}

export async function listComments(storyId: string) {
  const rows = await Comment.find({ storyId }).sort({ createdAt: 1 }).lean();
  const users = await User.find({ _id: { $in: [...new Set(rows.map((r) => r.userId))] } }).select("username name avatarUrl").lean();
  const by = new Map(users.map((u) => [u._id, authorShape(u)]));
  return rows.map(({ _id, ...r }) => ({ id: _id, ...r, user: by.get(r.userId) ?? null }));
}

export async function deleteComment(userId: string, commentId: string): Promise<void> {
  await Comment.deleteMany({ _id: commentId, userId });
}

export async function shareStory(senderId: string, storyId: string, receiverUsername: string) {
  const receiver = await User.findOne({ username: receiverUsername }).lean();
  if (!receiver) throw new NotFoundError("User");
  await storyAuthorId(storyId);
  const res = await Share.updateOne({ storyId, senderId, receiverId: receiver._id }, { $setOnInsert: { storyId, senderId, receiverId: receiver._id } }, { upsert: true });
  if (res.upsertedCount === 0) return { alreadyShared: true };
  await publishEvent({ recipientId: receiver._id, senderId, type: "SHARE", message: `${await nameOf(senderId)} shared a story with you`, storyId });
  return { alreadyShared: false };
}

export async function toggleBookmark(userId: string, storyId: string) {
  const del = await Bookmark.deleteOne({ userId, storyId });
  if (del.deletedCount) return { bookmarked: false };
  await Bookmark.create({ userId, storyId });
  return { bookmarked: true };
}
