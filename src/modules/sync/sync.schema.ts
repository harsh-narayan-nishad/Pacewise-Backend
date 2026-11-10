import { z } from "zod";

const record = z.record(z.unknown());
const op = z.discriminatedUnion("op", [
  z.object({ op: z.literal("put"), collection: z.string().min(1).max(50), id: z.string().min(1).max(200), data: record }),
  z.object({ op: z.literal("delete"), collection: z.string().min(1).max(50), id: z.string().min(1).max(200) }),
]);

export const opsBodySchema = z.object({ ops: z.array(op).min(1).max(300) });
export const snapshotQuerySchema = z.object({ since: z.coerce.number().int().min(0).optional().default(0) });
