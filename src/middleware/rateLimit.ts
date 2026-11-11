import { NextFunction, Request, Response } from "express";
import { redis } from "@/config/redis";
import { AppError } from "@/utils/AppError";

const memory = new Map<string, { count: number; resetAt: number }>();

/** Fixed-window limiter. Redis-backed when REDIS_URL is set (shared by all
 *  instances), otherwise an in-process map (correct for one instance). */
export function rateLimit(opts: { windowSeconds: number; max: number; keyPrefix: string; key?: (req: Request) => string }) {
  return function rateLimitMiddleware(req: Request, _res: Response, next: NextFunction): void {
    const identity = opts.key ? opts.key(req) : req.user?.id ?? req.ip ?? "anonymous";
    const key = `ratelimit:${opts.keyPrefix}:${identity}`;

    if (!redis) {
      const now = Date.now();
      const hit = memory.get(key);
      const entry = !hit || hit.resetAt < now ? { count: 0, resetAt: now + opts.windowSeconds * 1000 } : hit;
      entry.count += 1;
      memory.set(key, entry);
      if (memory.size > 50_000) for (const [k, v] of memory) if (v.resetAt < now) memory.delete(k);
      if (entry.count > opts.max) next(new AppError(429, "Too many requests — slow down", "RATE_LIMITED"));
      else next();
      return;
    }

    const client = redis; // not null here (checked above); a local copy keeps that known inside the callback
    client
      .incr(key)
      .then(async (count) => {
        if (count === 1) await client.expire(key, opts.windowSeconds);
        if (count > opts.max) {
          next(new AppError(429, "Too many requests — slow down", "RATE_LIMITED"));
          return;
        }
        next();
      })
      .catch(next);
  };
}
