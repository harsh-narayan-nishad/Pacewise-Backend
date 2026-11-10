import { FilterQuery } from "mongoose";
import { Story, User } from "@/models";
import { ForbiddenError, NotFoundError } from "@/utils/AppError";

interface ListStoriesParams { q?: string; tag?: string; authorUsername?: string; page: number; pageSize: number }

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

type StoryLean = { _id: string; authorId: string } & Record<string, unknown>;

async function withAuthors(rows: StoryLean[]) {
  const ids = [...new Set(rows.map((r) => r.authorId))];
  const users = await User.find({ _id: { $in: ids } }).select("username name avatarUrl").lean();
  const byId = new Map(users.map((u) => [u._id, { username: u.username, name: u.name, avatarUrl: u.avatarUrl ?? null }]));
  return rows.map(({ _id, ...rest }) => ({ id: _id, ...rest, author: byId.get(rest.authorId as string) ?? null }));
}

export async function listStories(params: ListStoriesParams) {
  const where: FilterQuery<unknown> = {};
  if (params.q) {
    const re = new RegExp(escapeRe(params.q), "i");
    where.$or = [{ title: re }, { description: re }];
  }
  if (params.tag) where.tags = params.tag;
  if (params.authorUsername) {
    const a = await User.findOne({ username: params.authorUsername }).select("_id").lean();
    where.authorId = a?._id ?? "__none__";
  }
  const [rows, total] = await Promise.all([
    Story.find(where).sort({ createdAt: -1 }).skip((params.page - 1) * params.pageSize).limit(params.pageSize).lean(),
    Story.countDocuments(where),
  ]);
  return { items: await withAuthors(rows as unknown as StoryLean[]), total, page: params.page, pageSize: params.pageSize };
}

export async function getStory(id: string) {
  const row = await Story.findById(id).lean();
  if (!row) throw new NotFoundError("Story");
  return (await withAuthors([row as unknown as StoryLean]))[0];
}

export async function createStory(authorId: string, data: Record<string, unknown>) {
  const s = await Story.create({ ...data, authorId });
  return s.toJSON();
}

async function owned(userId: string, id: string) {
  const story = await Story.findById(id);
  if (!story) throw new NotFoundError("Story");
  if (story.authorId !== userId) throw new ForbiddenError("You do not own this story");
  return story;
}

export async function updateStory(userId: string, id: string, data: Record<string, unknown>) {
  const story = await owned(userId, id);
  story.set(data);
  await story.save();
  return story.toJSON();
}

export async function deleteStory(userId: string, id: string): Promise<void> {
  const story = await owned(userId, id);
  await story.deleteOne();
}
