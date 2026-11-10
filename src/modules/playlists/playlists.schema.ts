import { z } from "zod";

export const playlistIdParamSchema = z.object({ id: z.string().min(1) });
export const playlistItemParamSchema = z.object({ id: z.string().min(1), storyId: z.string().min(1) });
export const userIdParamSchema = z.object({ userId: z.string().min(1) });

export const createPlaylistSchema = z.object({ name: z.string().min(1).max(200), isPublic: z.boolean().optional() });
export const updatePlaylistSchema = z.object({ name: z.string().min(1).max(200).optional(), isPublic: z.boolean().optional() });
export const addItemSchema = z.object({ storyId: z.string().min(1) });
