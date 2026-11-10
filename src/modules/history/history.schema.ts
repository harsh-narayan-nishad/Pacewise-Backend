import { z } from "zod";

export const createSessionSchema = z.object({
  storyId: z.string().min(1).optional(),
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
});

export const listSessionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});
