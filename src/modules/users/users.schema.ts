import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  interests: z.array(z.string().min(1).max(40)).max(20).optional(),
  avatarUrl: z.string().url().optional(),
});

export const usernameParamSchema = z.object({
  username: z.string().min(1),
});
