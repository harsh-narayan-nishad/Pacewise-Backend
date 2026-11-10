import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "@/utils/jwt";
import { ForbiddenError, UnauthorizedError } from "@/utils/AppError";
import { guardAccount } from "@/modules/admin/accountGuard";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; username: string; role?: "user" | "admin" };
    }
  }
}

/** Reads `Authorization: Bearer <token>`, verifies it stateless-ly (no DB
 *  call — see utils/jwt.ts), and attaches `req.user`. Any client that can
 *  send an HTTP header — the Next.js app, a React Native app, curl — uses
 *  the exact same mechanism; nothing here is web-specific (no cookies). */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  // Bearer header is the normal path for every ordinary request. The one
  // exception is an EventSource connection (GET /notifications/stream):
  // the browser's EventSource API cannot set custom headers, so that one
  // route's client sends the access token as `?token=` instead — see
  // lib/api/endpoints.ts's streamUrl() on the frontend.
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : (req.query.token as string | undefined);
  if (!token) {
    throw new UnauthorizedError("Missing bearer token");
  }
  let user: NonNullable<Request["user"]>;
  try {
    const payload = verifyAccessToken(token);
    user = { id: payload.sub, username: payload.username };
    req.user = user;
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }
  // Banned / not-yet-approved accounts are stopped here, and "last seen" is recorded (see accountGuard.ts).
  guardAccount(user.id).then((g) => { user.role = g.role; next(); }, next);
}

/** requireAuth, then only administrators get through. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, (err?: unknown) => {
    if (err) return next(err);
    if (req.user?.role !== "admin") return next(new ForbiddenError("Administrators only"));
    next();
  });
}

/** Same as requireAuth but never rejects — for routes that behave
 *  differently when logged in (e.g. a story feed ranked by interests) but
 *  are still readable by an anonymous client. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const payload = verifyAccessToken(header.slice("Bearer ".length));
      req.user = { id: payload.sub, username: payload.username };
    } catch {
      // Invalid token on an optional route: proceed unauthenticated
      // rather than rejecting — the caller asked for "optional".
    }
  }
  next();
}
