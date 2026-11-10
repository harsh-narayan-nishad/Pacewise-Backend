import { Request, Response } from "express";
import * as usersService from "@/modules/users/users.service";
import { asyncHandler } from "@/utils/asyncHandler";
import { UnauthorizedError } from "@/utils/AppError";

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const profile = await usersService.getPublicProfile(req.params.username);
  res.json(profile);
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const updated = await usersService.updateProfile(req.user.id, req.body);
  res.json(updated);
});

export const followUser = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const result = await usersService.follow(req.user.id, req.params.username);
  res.status(200).json(result);
});

export const unfollowUser = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  await usersService.unfollow(req.user.id, req.params.username);
  res.status(204).send();
});

export const listDirectory = asyncHandler(async (req: Request, res: Response) => {
  res.json(await usersService.listDirectory(req.query.updatedSince as string | undefined));
});
