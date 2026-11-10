import jwt from "jsonwebtoken";
import { env } from "@/config/env";

export interface AccessTokenPayload {
  sub: string; // user id
  username: string;
}

/**
 * Access tokens are stateless by design: verifying one is pure
 * cryptography (`jwt.verify`), never a database lookup. This is the
 * single most important property for a distributed deployment — any
 * instance, behind any load balancer, with no shared session store, can
 * authenticate any request. Nothing about "is this user logged in" is
 * pinned to the instance that issued the token.
 *
 * Refresh tokens are the deliberate exception — they're opaque random
 * strings stored in MongoDB (see models/index.ts RefreshToken
 * model), checked against the DB on every use. That's what makes them
 * revocable (sign out one device, or all devices, instantly) and
 * per-device, which a pure-JWT refresh token can't do without a
 * server-side blocklist anyway — so it may as well be the source of
 * truth instead of a cache in front of one.
 */
export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_TTL });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}
