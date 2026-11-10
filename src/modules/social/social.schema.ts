import { z } from "zod";

export const storyIdParamSchema = z.object({ storyId: z.string().min(1) });
export const commentIdParamSchema = z.object({ commentId: z.string().min(1) });

export const reactionSchema = z.object({ type: z.enum(["LIKE", "DISLIKE"]) });
export const commentSchema = z.object({ text: z.string().min(1).max(2000) });
export const shareSchema = z.object({ receiverUsername: z.string().min(1) });
