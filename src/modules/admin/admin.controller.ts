import { Request, Response } from "express";
import * as admin from "@/modules/admin/admin.service";
import { asyncHandler } from "@/utils/asyncHandler";
import { UnauthorizedError } from "@/utils/AppError";
import type { AdminAction } from "@/modules/admin/identity";

const actor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError();
  return { id: req.user.id, username: req.user.username };
};

export const login = asyncHandler(async (req, res) => res.json(await admin.adminLogin(req.body)));
export const google = asyncHandler(async (req, res) => res.json(await admin.adminGoogleLogin(req.body)));
export const overview = asyncHandler(async (req, res) => res.json(await admin.overview((req.query as unknown as { includeDemo: boolean }).includeDemo)));
export const listUsers = asyncHandler(async (req, res) => res.json(await admin.listUsers(req.query as never)));
export const getUser = asyncHandler(async (req, res) => res.json({ user: await admin.getUser(req.params.id) }));

/** One handler per action keeps the routes readable; the rules themselves live in identity.ts (checkAdminAction). */
export const userAction = (action: AdminAction) =>
  asyncHandler(async (req: Request, res: Response) => res.json({ user: await admin.act(actor(req), req.params.id, action, (req.body as { reason?: string }).reason ?? "") }));

export const bulkApprove = asyncHandler(async (req, res) => res.json(await admin.bulkApprove(actor(req), req.body.ids)));
export const listReports = asyncHandler(async (req, res) => res.json(await admin.listReports(req.query as never)));
export const updateReport = asyncHandler(async (req, res) => res.json(await admin.updateReport(actor(req), req.params.id, req.body)));
export const removeContent = asyncHandler(async (req, res) => res.json(await admin.removeContent(actor(req), req.body)));
export const listAudit = asyncHandler(async (req, res) => res.json(await admin.listAudit(req.query as never)));
