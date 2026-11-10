import { Request, Response } from "express";
import * as playlistsService from "@/modules/playlists/playlists.service";
import { asyncHandler } from "@/utils/asyncHandler";
import { UnauthorizedError } from "@/utils/AppError";

export const list = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  res.json(await playlistsService.listPlaylists(req.user.id));
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  // optionalAuth (see routes) — req.user may be absent for a signed-out
  // visitor reading a public playlist; getPlaylist itself enforces that
  // only the owner can read a private one.
  res.json(await playlistsService.getPlaylist(req.user?.id, req.params.id));
});

export const listPublic = asyncHandler(async (req: Request, res: Response) => {
  res.json(await playlistsService.listPublicPlaylists(req.params.userId));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const playlist = await playlistsService.createPlaylist(req.user.id, req.body.name, req.body.isPublic);
  res.status(201).json(playlist);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const playlist = await playlistsService.updatePlaylist(req.user.id, req.params.id, req.body);
  res.json(playlist);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  await playlistsService.deletePlaylist(req.user.id, req.params.id);
  res.status(204).send();
});

export const addItem = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const item = await playlistsService.addItem(req.user.id, req.params.id, req.body.storyId);
  res.status(201).json(item);
});

export const removeItem = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  await playlistsService.removeItem(req.user.id, req.params.id, req.params.storyId);
  res.status(204).send();
});
