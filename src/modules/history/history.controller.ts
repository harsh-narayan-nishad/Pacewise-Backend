import { Request, Response } from "express";
import * as historyService from "@/modules/history/history.service";
import { asyncHandler } from "@/utils/asyncHandler";
import { UnauthorizedError } from "@/utils/AppError";

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const session = await historyService.recordSession(req.user.id, req.body);
  res.status(201).json(session);
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  res.json(await historyService.listSessions(req.user.id, page, pageSize));
});

export const stats = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  res.json(await historyService.getStats(req.user.id));
});
