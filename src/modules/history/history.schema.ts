import { z } from "zod";

const topicScore = z
  .object({ topic: z.string().trim().min(1).max(80), correct: z.number().int().min(0), total: z.number().int().min(1) })
  .refine((t) => t.correct <= t.total, "correct cannot be more than total");

export const createSessionSchema = z.object({
  storyId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  wordCount: z.number().int().min(0).optional(),
  wpm: z.number().int().positive(),
  minutes: z.number().int().min(0),
  completed: z.boolean(),
  breakMs: z.number().int().min(0).optional().default(0),
  breakCount: z.number().int().min(0).optional().default(0),
  effectiveWpm: z.number().positive().optional(),
  reductionPercent: z.number().optional(),
  accuracy: z.number().min(0).max(100).optional(),
  totalQuestions: z.number().int().min(0).optional(),
  correctAnswers: z.number().int().min(0).optional(),
  topics: z.array(topicScore).max(100).optional(),
});

export const listSessionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const sessionIdParamSchema = z.object({ id: z.string().min(1).max(100) });
export const updateTopicsSchema = z.object({ topics: z.array(topicScore).min(1).max(100) });

export const highlightsQuerySchema = z.object({ today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });
