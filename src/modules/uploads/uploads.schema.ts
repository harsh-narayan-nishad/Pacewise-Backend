import { z } from "zod";

export const presignUploadSchema = z.object({
  filename: z.string().min(1).max(300),
  contentType: z.string().min(1).max(200),
});

export const keyParamSchema = z.object({
  key: z.string().min(1),
});
