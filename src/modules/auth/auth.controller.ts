import { Request, Response } from "express";
import * as authService from "@/modules/auth/auth.service";
import { asyncHandler } from "@/utils/asyncHandler";
import { requireAuth } from "@/middleware/auth";
import { UnauthorizedError } from "@/utils/AppError";

export const signup = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.signup(req.body);
  res.status(201).json(result);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body);
  res.status(200).json(result);
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.refresh(req.body.refreshToken);
  res.status(200).json(result);
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await authService.logout(req.body.refreshToken);
  res.status(204).send();
});

export const logoutAll = [
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    await authService.logoutAllDevices(req.user.id);
    res.status(204).send();
  }),
];

export const me = [
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    res.json({ user: await authService.me(req.user.id) });
  }),
];

export const changePassword = [
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new UnauthorizedError();
    res.json(await authService.changePassword(req.user.id, req.body, req.body.device));
  }),
];

export const availability = asyncHandler(async (req: Request, res: Response) => {
  res.json(await authService.availability(req.query as { username?: string; email?: string }));
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => res.json(await authService.verifyEmail(req.body.token)));
export const resendVerification = asyncHandler(async (req: Request, res: Response) => res.status(202).json(await authService.resendVerification(req.body.email)));
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => res.status(202).json(await authService.forgotPassword(req.body.email)));
export const resetPassword = asyncHandler(async (req: Request, res: Response) => res.json(await authService.resetPassword(req.body)));

export const verifyEmailOtp = asyncHandler(async (req: Request, res: Response) => res.json(await authService.verifyEmailOtp(req.body.email, req.body.otp)));
export const resetPasswordOtp = asyncHandler(async (req: Request, res: Response) => res.json(await authService.resetPasswordOtp(req.body)));
