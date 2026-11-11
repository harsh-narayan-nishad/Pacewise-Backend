import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  interests: z.array(z.string().min(1).max(40)).max(20).optional(),
  avatarUrl: z.string().url().optional(),
});

export const usernameParamSchema = z.object({
  username: z.string().min(1),
});

export const userIdParamSchema = z.object({ id: z.string().min(1).max(100) });
export const relationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(30),
});
