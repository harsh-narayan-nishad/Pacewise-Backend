import { Router } from "express";
import * as uploadsController from "@/modules/uploads/uploads.controller";
import { requireAuth } from "@/middleware/auth";
import { validate } from "@/middleware/validate";
import { keyParamSchema, presignUploadSchema } from "@/modules/uploads/uploads.schema";
import { rateLimit } from "@/middleware/rateLimit";

export const uploadsRouter = Router();

// Presign requests are cheap but still worth rate-limiting per user: an
// unbounded client bug (or abuse) could otherwise mint unlimited S3 PUT
// URLs. Scoped to "uploads" so it doesn't share a bucket with auth/API
// rate limits.
const uploadRateLimit = rateLimit({ windowSeconds: 60, max: 30, keyPrefix: "uploads" });

uploadsRouter.post("/presign", requireAuth, uploadRateLimit, validate({ body: presignUploadSchema }), uploadsController.presign);
uploadsRouter.get("/:key/url", validate({ params: keyParamSchema }), uploadsController.getDownloadUrl);
