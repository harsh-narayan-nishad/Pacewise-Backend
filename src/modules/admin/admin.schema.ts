import { z } from "zod";

const page = z.coerce.number().int().min(1).default(1);
const limit = z.coerce.number().int().min(1).max(100).default(25);
const bool = z.enum(["true", "false"]).default("false").transform((v) => v === "true");

export const listUsersQuery = z.object({
  status: z.enum(["pending", "active", "rejected", "banned"]).optional(),
  role: z.enum(["user", "admin"]).optional(),
  presence: z.enum(["online", "idle", "offline"]).optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(["created", "seen"]).default("created"),
  includeDemo: bool,
  page,
  limit,
});
export type ListUsersQuery = z.infer<typeof listUsersQuery>;

export const overviewQuery = z.object({ includeDemo: bool });

export const idParam = z.object({ id: z.string().min(1).max(100) });
export const reasonBody = z.object({ reason: z.string().trim().max(500).optional() });
export const banBody = z.object({ reason: z.string().trim().min(3, "Give a reason").max(500) });
export const bulkApproveBody = z.object({ ids: z.array(z.string().min(1)).min(1).max(100) });

export const listReportsQuery = z.object({
  status: z.enum(["open", "reviewing", "resolved", "dismissed"]).optional(),
  targetType: z.enum(["story", "comment", "user"]).optional(),
  page,
  limit,
});
export const updateReportBody = z.object({
  status: z.enum(["open", "reviewing", "resolved", "dismissed"]),
  resolution: z.string().trim().max(1000).optional(),
});
export const removeContentBody = z.object({ type: z.enum(["story", "comment"]), id: z.string().min(1), reportId: z.string().optional(), reason: z.string().trim().max(500).optional() });
export const auditQuery = z.object({ page, limit: z.coerce.number().int().min(1).max(100).default(50) });

export const createReportBody = z.object({
  targetType: z.enum(["story", "comment", "user"]),
  targetId: z.string().min(1).max(100),
  reason: z.enum(["spam", "harassment", "inappropriate", "misinformation", "impersonation", "other"]),
  details: z.string().trim().max(1000).optional(),
});
