import { Playlist, Story } from "@/models";
import { ForbiddenError, NotFoundError } from "@/utils/AppError";

async function ownedPlaylist(userId: string, id: string) {
  const p = await Playlist.findById(id);
  if (!p) throw new NotFoundError("Playlist");
  if (p.userId !== userId) throw new ForbiddenError("You do not own this playlist");
  return p;
}

type PlaylistLean = { _id: string; items: { storyId: string; addedAt?: Date }[] } & Record<string, unknown>;

async function withStories(rows: PlaylistLean[]) {
  const ids = [...new Set(rows.flatMap((r) => r.items.map((i) => i.storyId)))];
  const stories = await Story.find({ _id: { $in: ids } }).select("title").lean();
  const by = new Map(stories.map((s) => [s._id, { id: s._id, title: s.title }]));
  return rows.map(({ _id, ...r }) => ({
    id: _id,
    ...r,
    items: r.items.map((i) => ({ playlistId: _id, storyId: i.storyId, addedAt: i.addedAt, story: by.get(i.storyId) ?? null })),
  }));
}

export async function listPlaylists(userId: string) {
  return withStories((await Playlist.find({ userId }).sort({ createdAt: -1 }).lean()) as unknown as PlaylistLean[]);
}

export async function getPlaylist(viewerId: string | undefined, id: string) {
  const p = await Playlist.findById(id).lean();
  if (!p) throw new NotFoundError("Playlist");
  if (!p.isPublic && p.userId !== viewerId) throw new ForbiddenError("You do not own this playlist");
  return (await withStories([p as unknown as PlaylistLean]))[0];
}

export async function listPublicPlaylists(userId: string) {
  return withStories((await Playlist.find({ userId, isPublic: true }).sort({ createdAt: -1 }).lean()) as unknown as PlaylistLean[]);
}

export async function createPlaylist(userId: string, name: string, isPublic = false) {
  return (await Playlist.create({ userId, name, isPublic })).toJSON();
}

export async function updatePlaylist(userId: string, id: string, data: { name?: string; isPublic?: boolean }) {
  const p = await ownedPlaylist(userId, id);
  p.set(data);
  await p.save();
  return p.toJSON();
}

export async function deletePlaylist(userId: string, id: string): Promise<void> {
  await (await ownedPlaylist(userId, id)).deleteOne();
}

export async function addItem(userId: string, playlistId: string, storyId: string) {
  const p = await ownedPlaylist(userId, playlistId);
  if (!(await Story.exists({ _id: storyId }))) throw new NotFoundError("Story");
  if (!p.items.some((i) => i.storyId === storyId)) {
    p.items.push({ storyId, addedAt: new Date() });
    await p.save();
  }
  return { playlistId, storyId };
}

export async function removeItem(userId: string, playlistId: string, storyId: string): Promise<void> {
  await Playlist.updateOne({ _id: playlistId, userId }, { $pull: { items: { storyId } } });
  await ownedPlaylist(userId, playlistId);
}
