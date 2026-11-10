import { Request, Response } from "express";
import * as storiesService from "@/modules/stories/stories.service";
import { asyncHandler } from "@/utils/asyncHandler";
import { UnauthorizedError } from "@/utils/AppError";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { q, tag, authorUsername, page, pageSize } = req.query as unknown as {
    q?: string;
    tag?: string;
    authorUsername?: string;
    page: number;
    pageSize: number;
  };
  const result = await storiesService.listStories({ q, tag, authorUsername, page, pageSize });
  res.json(result);
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const story = await storiesService.getStory(req.params.id);
  res.json(story);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const story = await storiesService.createStory(req.user.id, req.body);
  res.status(201).json(story);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const story = await storiesService.updateStory(req.user.id, req.params.id, req.body);
  res.json(story);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  await storiesService.deleteStory(req.user.id, req.params.id);
  res.status(204).send();
});
