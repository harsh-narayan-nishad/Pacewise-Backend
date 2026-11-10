import { z } from "zod";

export const storyIdParamSchema = z.object({ id: z.string().min(1) });

export const mediaPageSchema = z.object({
  src: z.string().min(1),
  width: z.number().positive(),
  height: z.number().positive(),
});

export const mediaSchema = z.object({
  kind: z.enum(["pdf", "image"]),
  pages: z.array(mediaPageSchema).min(1),
  estimatedWordCount: z.number().int().positive(),
});

export const questionSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
  correctIndex: z.number().int().min(0),
});

// Mirrors the Story collection (and, before it, the frontend's StoryData
// shape in types/index.ts): title/description/level/estimatedWPM/tags are
// plain scalar columns; paragraphs/questions/media stay as JSON blobs
// because they're always read whole, never filtered field-by-field.
export const createStorySchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  level: z.string().min(1).max(50).default("beginner"),
  estimatedWPM: z.number().int().positive().default(250),
  tags: z.array(z.string()).optional().default([]),
  paragraphs: z.array(z.string()).optional().default([]),
  questions: z.array(questionSchema).optional().default([]),
  media: mediaSchema.optional(),
});

export const updateStorySchema = createStorySchema.partial();

export const listStoriesQuerySchema = z.object({
  q: z.string().optional(),
  tag: z.string().optional(),
  authorUsername: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});
