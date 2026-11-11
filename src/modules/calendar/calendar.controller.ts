import { Request, Response } from "express";
import * as calendarService from "@/modules/calendar/calendar.service";
import { asyncHandler } from "@/utils/asyncHandler";
import { UnauthorizedError } from "@/utils/AppError";

export const list = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const { from, to } = req.query as unknown as { from?: Date; to?: Date };
  res.json(await calendarService.listEvents(req.user.id, from, to));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  res.status(201).json(await calendarService.createEvent(req.user.id, req.body));
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  res.json(await calendarService.updateEvent(req.user.id, req.params.id, req.body));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  await calendarService.deleteEvent(req.user.id, req.params.id);
  res.status(204).end();
});
