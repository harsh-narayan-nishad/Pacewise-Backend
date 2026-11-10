import { Request, Response } from "express";
import * as socialService from "@/modules/social/social.service";
import { asyncHandler } from "@/utils/asyncHandler";
import { UnauthorizedError } from "@/utils/AppError";

export const react = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const reaction = await socialService.setReaction(req.user.id, req.params.storyId, req.body.type);
  res.status(200).json(reaction);
});

export const clearReaction = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  await socialService.clearReaction(req.user.id, req.params.storyId);
  res.status(204).send();
});

export const listComments = asyncHandler(async (req: Request, res: Response) => {
  const comments = await socialService.listComments(req.params.storyId);
  res.json(comments);
});

export const addComment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const comment = await socialService.addComment(req.user.id, req.params.storyId, req.body.text);
  res.status(201).json(comment);
});

export const deleteComment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  await socialService.deleteComment(req.user.id, req.params.commentId);
  res.status(204).send();
});

export const share = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const result = await socialService.shareStory(req.user.id, req.params.storyId, req.body.receiverUsername);
  res.status(200).json(result);
});

export const toggleBookmark = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const result = await socialService.toggleBookmark(req.user.id, req.params.storyId);
  res.status(200).json(result);
});
