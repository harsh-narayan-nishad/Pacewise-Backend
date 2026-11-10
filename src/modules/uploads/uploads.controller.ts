import { Request, Response } from "express";
import * as uploadsService from "@/modules/uploads/uploads.service";
import { asyncHandler } from "@/utils/asyncHandler";
import { UnauthorizedError } from "@/utils/AppError";

export const presign = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const { filename, contentType } = req.body as { filename: string; contentType: string };
  const result = await uploadsService.createPresignedUpload(req.user.id, filename, contentType);
  res.status(201).json(result);
});

export const getDownloadUrl = asyncHandler(async (req: Request, res: Response) => {
  const key = decodeURIComponent(req.params.key);
  const result = await uploadsService.createPresignedDownload(key);
  res.json(result);
});
