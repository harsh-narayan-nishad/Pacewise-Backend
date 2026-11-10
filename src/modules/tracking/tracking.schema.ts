import { z } from "zod";
import { DAY_RE } from "@/modules/tracking/consistency";

const day = z.string().regex(DAY_RE);
const MAX_MS = 6 * 60 * 60 * 1000; // a single event can never claim more than 6 hours

export const eventSchema = z.discriminatedUnion("type", [
  // Reading time on one story / doc / the auto-scroll reader.
  z.object({
    type: z.literal("time"),
    opId: z.string().min(8).max(100),
    day,
    kind: z.enum(["story", "doc", "reader"]),
    itemId: z.string().min(1).max(300),
    title: z.string().max(300).optional(),
    ms: z.number().int().min(0).max(MAX_MS),
    opened: z.boolean().optional(),
    at: z.string().optional(),
  }),
  // A countable thing that happened (quiz taken, story finished, doc read).
  z.object({
    type: z.literal("count"),
    opId: z.string().min(8).max(100),
    day,
    field: z.enum(["testsTaken", "storiesRead", "docsRead"]),
    inc: z.number().int().min(1).max(50).default(1),
  }),
]);
export const eventsBodySchema = z.object({ events: z.array(eventSchema).min(1).max(200) });

export const BLOB_KEYS = ["history", "streak", "daily", "bookmarks", "achievements", "customStories", "searchHistory", "timelog", "doctime", "settings"] as const;
export const blobParamSchema = z.object({ key: z.enum(BLOB_KEYS) });
export const blobBodySchema = z.object({ value: z.unknown(), rev: z.number().int().min(0).optional() });
export const summaryQuerySchema = z.object({ today: day.optional(), minActiveMs: z.coerce.number().int().min(1000).max(3_600_000).optional() });
