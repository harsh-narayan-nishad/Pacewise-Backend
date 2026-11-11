import { z } from "zod";

const variant = z.enum(["primary", "secondary", "outline"]);
const when = z.coerce.date();

/** An event must not end before it starts. */
const ordered = (v: { start?: Date; end?: Date }) => !v.start || !v.end || v.end.getTime() >= v.start.getTime();
const orderedMsg = { message: "The end must not be before the start.", path: ["end"] };

export const createEventSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(120),
    start: when,
    end: when,
    allDay: z.boolean().optional().default(false),
    variant: variant.optional().default("primary"),
  })
  .refine(ordered, orderedMsg);

export const updateEventSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    start: when.optional(),
    end: when.optional(),
    allDay: z.boolean().optional(),
    variant: variant.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update." })
  .refine(ordered, orderedMsg);

/** Optional window, so the page only loads the events it shows. */
export const listEventsQuerySchema = z.object({ from: when.optional(), to: when.optional() });

export const eventIdParamSchema = z.object({ id: z.string().min(1).max(100) });
