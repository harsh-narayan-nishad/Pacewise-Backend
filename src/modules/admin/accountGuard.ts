import { User } from "@/models";
import { AppError, UnauthorizedError } from "@/utils/AppError";

/**
 * Runs on every authenticated request (see middleware/auth.ts):
 *  1. blocks accounts that are banned / pending / declined, even if their 15-minute token is still valid;
 *  2. records "last seen" (at most once per 30 s per person) so the admin app can show who is online.
 * Status is cached for 15 s per process, so a ban takes effect within ~15 s everywhere and the database is not hit on every call.
 */
const STATUS_TTL_MS = 15_000;
const SEEN_EVERY_MS = 30_000;
const cache = new Map<string, { status: string; role: string; at: number }>();
const lastWrite = new Map<string, number>();

export const MESSAGES: Record<string, [string, string]> = {
  banned: ["ACCOUNT_BANNED", "This account has been suspended."],
  pending: ["ACCOUNT_PENDING", "Your account is waiting for admin approval. You will get an email when it is approved."],
  rejected: ["ACCOUNT_REJECTED", "Your account request was declined."],
};

/** Call after changing someone's status or role so this process applies it immediately. */
export function forgetAccount(userId: string): void {
  cache.delete(userId);
}

export async function guardAccount(userId: string): Promise<{ role: "user" | "admin" }> {
  const now = Date.now();
  let hit = cache.get(userId);
  if (!hit || now - hit.at > STATUS_TTL_MS) {
    const u = await User.findById(userId).select("status role").lean();
    if (!u) throw new UnauthorizedError("Account no longer exists");
    hit = { status: u.status ?? "active", role: u.role ?? "user", at: now };
    cache.set(userId, hit);
    if (cache.size > 20_000) for (const [k, v] of cache) if (now - v.at > STATUS_TTL_MS) cache.delete(k);
  }
  if (hit.status !== "active") {
    const [code, message] = MESSAGES[hit.status] ?? MESSAGES.banned;
    throw new AppError(403, message, code);
  }
  if (now - (lastWrite.get(userId) ?? 0) > SEEN_EVERY_MS) {
    lastWrite.set(userId, now);
    if (lastWrite.size > 20_000) for (const [k, v] of lastWrite) if (now - v > SEEN_EVERY_MS) lastWrite.delete(k);
    // timestamps:false — "last seen" must not bump updatedAt, which the people-directory sync uses to detect real changes.
    void User.updateOne({ _id: userId }, { $set: { lastSeenAt: new Date() } }, { timestamps: false }).catch(() => undefined);
  }
  return { role: hit.role === "admin" ? "admin" : "user" };
}
