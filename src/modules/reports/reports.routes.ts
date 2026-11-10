import { Router } from "express";
import { requireAuth } from "@/middleware/auth";
import { validate } from "@/middleware/validate";
import { rateLimit } from "@/middleware/rateLimit";
import { asyncHandler } from "@/utils/asyncHandler";
import { createReportBody } from "@/modules/admin/admin.schema";
import { createReport } from "@/modules/reports/reports.service";

export const reportsRouter = Router();

// 10 reports per hour per person, so the report button cannot be used to flood the admin inbox.
reportsRouter.post(
  "/",
  requireAuth,
  rateLimit({ windowSeconds: 60 * 60, max: 10, keyPrefix: "report" }),
  validate({ body: createReportBody }),
  asyncHandler(async (req, res) => res.status(201).json(await createReport(req.user!.id, req.body)))
);
