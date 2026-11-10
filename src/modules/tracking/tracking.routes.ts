import { Request, Response, Router } from "express";
import { requireAuth } from "@/middleware/auth";
import { validate } from "@/middleware/validate";
import { rateLimit } from "@/middleware/rateLimit";
import { asyncHandler } from "@/utils/asyncHandler";
import { UnauthorizedError } from "@/utils/AppError";
import { blobBodySchema, blobParamSchema, eventsBodySchema, summaryQuerySchema } from "@/modules/tracking/tracking.schema";
import * as tracking from "@/modules/tracking/tracking.service";

export const trackingRouter = Router();
trackingRouter.use(requireAuth);

const uid = (req: Request): string => {
  if (!req.user) throw new UnauthorizedError();
  return req.user.id;
};
const todayUtc = () => new Date().toISOString().slice(0, 10);

trackingRouter.post(
  "/events",
  rateLimit({ windowSeconds: 60, max: 600, keyPrefix: "tracking-events" }),
  validate({ body: eventsBodySchema }),
  asyncHandler(async (req: Request, res: Response) => res.json(await tracking.recordEvents(uid(req), req.body.events)))
);

trackingRouter.get(
  "/summary",
  validate({ query: summaryQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as { today?: string; minActiveMs?: number };
    res.json(await tracking.getSummary(uid(req), q.today ?? todayUtc(), q.minActiveMs));
  })
);

trackingRouter.get(
  "/state",
  validate({ query: summaryQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as { today?: string };
    res.json(await tracking.getState(uid(req), q.today ?? todayUtc()));
  })
);

trackingRouter.put(
  "/blobs/:key",
  validate({ params: blobParamSchema, body: blobBodySchema }),
  asyncHandler(async (req: Request, res: Response) => res.json(await tracking.putBlob(uid(req), req.params.key, req.body.value)))
);
