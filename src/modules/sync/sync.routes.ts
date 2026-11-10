import { Request, Response, Router } from "express";
import { requireAuth } from "@/middleware/auth";
import { validate } from "@/middleware/validate";
import { rateLimit } from "@/middleware/rateLimit";
import { asyncHandler } from "@/utils/asyncHandler";
import { UnauthorizedError } from "@/utils/AppError";
import { opsBodySchema, snapshotQuerySchema } from "@/modules/sync/sync.schema";
import * as sync from "@/modules/sync/sync.service";

export const syncRouter = Router();
syncRouter.use(requireAuth);

syncRouter.post(
  "/ops",
  rateLimit({ windowSeconds: 60, max: 600, keyPrefix: "sync-ops" }),
  validate({ body: opsBodySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    res.json(await sync.applyOps(req.user.id, req.body.ops));
  })
);

syncRouter.get(
  "/snapshot",
  validate({ query: snapshotQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    const { since } = req.query as unknown as { since: number };
    res.json(await sync.snapshot(req.user.id, since));
  })
);
