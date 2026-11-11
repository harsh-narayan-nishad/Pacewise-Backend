import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import ms from "ms";
import { AuthToken, BannedIdentity, RefreshToken, User } from "@/models";
import { canonicalEmail } from "@/modules/admin/identity";
import { MESSAGES } from "@/modules/admin/accountGuard";
import { resetPasswordMail, sendMail, verifyEmailMail, welcomeMail } from "@/utils/mailer";
import { logger } from "@/config/logger";
import { signAccessToken } from "@/utils/jwt";
import { AppError, ConflictError, NotFoundError, UnauthorizedError } from "@/utils/AppError";
import { env } from "@/config/env";
import { ChangePasswordInput, GoogleInput, LoginInput, ResetOtpInput, ResetPasswordInput, SignupInput } from "@/modules/auth/auth.schema";

const newRefreshToken = () => crypto.randomBytes(48).toString("hex");
const refreshExpiryDate = () => new Date(Date.now() + ms(env.JWT_REFRESH_TTL as ms.StringValue));

async function issueTokenPair(userId: string, username: string, device?: string) {
  const accessToken = signAccessToken({ sub: userId, username });
  const refreshToken = newRefreshToken();
  await RefreshToken.create({ userId, token: refreshToken, device, expiresAt: refreshExpiryDate() });
  return { accessToken, refreshToken };
}

// Compared against when the account does not exist, so "unknown user" and "wrong password" take the same time.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

export async function signup(input: SignupInput) {
  const existing = await User.findOne({ $or: [{ email: input.email.toLowerCase() }, { username: input.username }] }).lean();
  if (existing) throw new ConflictError("Email or username already in use");
  // A banned person cannot come back with the same inbox (dots / +tags / googlemail are treated as the same address).
  if (await BannedIdentity.exists({ _id: canonicalEmail(input.email) })) throw new AppError(403, "This email address can't be used on Pacewise.", "ACCOUNT_BANNED");
  const passwordHash = await bcrypt.hash(input.password, 12);
  const status = env.requireAdminApproval ? "pending" : "active";
  const user = await User.create({ email: input.email, username: input.username, passwordHash, name: input.name, emailVerified: false, status });
  await sendVerification(user._id, user.email, user.name);
  const approvalRequired = status === "pending";
  // Welcome e-mail on first sign-up only. A mail outage must never block sign-up, so failures are only logged.
  try {
    const next = env.requireEmailVerification ? "confirm-email" : approvalRequired ? "wait-approval" : "sign-in";
    await sendMail({ to: user.email, ...welcomeMail(user.name, next, env.APP_URL) });
  } catch (err) { logger.error({ err }, "Could not send welcome e-mail"); }
  // No session yet when the e-mail must be confirmed first, or when an admin still has to approve the account.
  if (env.requireEmailVerification) return { user: toPublicUser(user), verificationRequired: true as const, approvalRequired };
  if (approvalRequired) return { user: toPublicUser(user), verificationRequired: false as const, approvalRequired };
  const tokens = await issueTokenPair(user._id, user.username, input.device);
  return { user: toPublicUser(user), verificationRequired: false as const, approvalRequired: false, ...tokens };
}

export async function login(input: LoginInput) {
  const ident = input.identifier.trim();
  const user = await User.findOne({ $or: [{ email: ident.toLowerCase() }, { username: ident }] });
  const valid = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) throw new UnauthorizedError("Incorrect email/username or password");
  if (user.status === "banned") throw new AppError(403, MESSAGES.banned[1], MESSAGES.banned[0]);
  if (env.requireEmailVerification && !user.emailVerified) throw new AppError(403, "Confirm your email first — check your inbox, or request a new link.", "EMAIL_NOT_VERIFIED");
  if (user.status === "pending" || user.status === "rejected") throw new AppError(403, MESSAGES[user.status][1], MESSAGES[user.status][0]);
  const tokens = await issueTokenPair(user._id, user.username, input.device);
  return { user: toPublicUser(user), ...tokens };
}

/** Refresh-token rotation with reuse detection (see README). */
export async function refresh(presentedToken: string) {
  const existing = await RefreshToken.findOne({ token: presentedToken });
  if (!existing || existing.expiresAt < new Date()) throw new UnauthorizedError("Refresh token expired or invalid");

  if (existing.revokedAt) {
    await RefreshToken.updateMany({ userId: existing.userId, revokedAt: null }, { revokedAt: new Date() });
    throw new UnauthorizedError("Refresh token already used — all sessions revoked");
  }
  const user = await User.findById(existing.userId);
  if (!user) throw new UnauthorizedError("Refresh token expired or invalid");
  if (user.status && user.status !== "active") {
    await RefreshToken.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() });
    throw new AppError(403, MESSAGES[user.status][1], MESSAGES[user.status][0]);
  }

  existing.revokedAt = new Date();
  await existing.save();
  const tokens = await issueTokenPair(user._id, user.username, existing.device ?? undefined);
  return { user: toPublicUser(user), ...tokens };
}

export async function me(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw new UnauthorizedError("Account no longer exists");
  return toPublicUser(user);
}

/** Changes the password and signs out every OTHER device; this one receives a fresh token pair. */
export async function changePassword(userId: string, input: ChangePasswordInput, device?: string) {
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError("User");
  if (!(await bcrypt.compare(input.currentPassword, user.passwordHash))) throw new UnauthorizedError("Current password is incorrect");
  if (input.currentPassword === input.newPassword) throw new ConflictError("New password must be different");
  user.passwordHash = await bcrypt.hash(input.newPassword, 12);
  await user.save();
  await RefreshToken.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() });
  return { user: toPublicUser(user), ...(await issueTokenPair(user._id, user.username, device)) };
}

/** For live "username taken" hints on the sign-up form. */
export async function availability(q: { username?: string; email?: string }) {
  const out: { username?: boolean; email?: boolean } = {};
  if (q.username) out.username = !(await User.exists({ username: q.username }));
  if (q.email) out.email = !(await User.exists({ email: q.email.toLowerCase() }));
  return out;
}

export async function logout(presentedToken: string): Promise<void> {
  await RefreshToken.updateMany({ token: presentedToken, revokedAt: null }, { revokedAt: new Date() });
}

export async function logoutAllDevices(userId: string): Promise<void> {
  await RefreshToken.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() });
}

export function toPublicUser(user: { _id: string; email: string; username: string; name: string; interests: string[]; avatarUrl?: string | null; emailVerified?: boolean; role?: string | null }) {
  return { id: user._id, email: user.email, username: user.username, name: user.name, interests: user.interests, avatarUrl: user.avatarUrl ?? null, emailVerified: user.emailVerified ?? false, role: user.role === "admin" ? "admin" : "user" };
}

// ---- E-mailed one-time tokens (verify e-mail, reset password) -------------------------------------------------
const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

/** Makes a fresh token (older ones of that kind stop working) and returns the raw value to put in the link. */
async function issueOneTimeToken(userId: string, type: "verify-email" | "reset-password", ttlMs: number): Promise<string> {
  await AuthToken.deleteMany({ userId, type });
  const raw = crypto.randomBytes(32).toString("hex");
  await AuthToken.create({ userId, type, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + ttlMs) });
  return raw;
}

async function sendVerification(userId: string, email: string, name: string): Promise<void> {
  try {
    const token = await issueOneTimeToken(userId, "verify-email", VERIFY_TTL_MS);
    const code = await issueOtp(userId, "verify-otp");
    await sendMail({ to: email, ...verifyEmailMail(name, `${env.APP_URL}/verify-email?token=${token}`, code) });
  } catch (err) {
    // A mail outage must not block sign-up; the person can ask for a new link.
    logger.error({ err }, "Could not send verification e-mail");
  }
}

export async function verifyEmail(token: string) {
  const row = await AuthToken.findOneAndDelete({ tokenHash: sha256(token), type: "verify-email", expiresAt: { $gt: new Date() } });
  if (!row) throw new AppError(400, "This link is invalid or has expired. Request a new one.", "INVALID_TOKEN");
  await User.updateOne({ _id: row.userId }, { emailVerified: true });
  return { verified: true };
}

/** Always answers the same, so the endpoint cannot be used to discover which e-mails have accounts. */
export async function resendVerification(email: string) {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (user && !user.emailVerified) await sendVerification(user._id, user.email, user.name);
  return { sent: true };
}

export async function forgotPassword(email: string) {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (user) {
    try {
      const token = await issueOneTimeToken(user._id, "reset-password", RESET_TTL_MS);
      const code = await issueOtp(user._id, "reset-otp");
      await sendMail({ to: user.email, ...resetPasswordMail(user.name, `${env.APP_URL}/reset-password?token=${token}`, code) });
    } catch (err) {
      logger.error({ err }, "Could not send password reset e-mail");
    }
  }
  return { sent: true };
}

/** The link proves the person controls the inbox, so the e-mail also becomes verified. Every session is signed out. */
export async function resetPassword(input: ResetPasswordInput) {
  const row = await AuthToken.findOneAndDelete({ tokenHash: sha256(input.token), type: "reset-password", expiresAt: { $gt: new Date() } });
  if (!row) throw new AppError(400, "This link is invalid or has expired. Request a new one.", "INVALID_TOKEN");
  await User.updateOne({ _id: row.userId }, { passwordHash: await bcrypt.hash(input.newPassword, 12), emailVerified: true });
  await RefreshToken.updateMany({ userId: row.userId, revokedAt: null }, { revokedAt: new Date() });
  return { reset: true };
}

// ---- One-time codes (OTP) e-mailed together with the links -----------------------------------------------------
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const WRONG_CODE = "That code is incorrect or has expired. Request a new one.";

/** HMAC (keyed with a server secret, bound to the user) so a stolen database cannot be used to brute-force the 6 digits offline. */
const otpHash = (userId: string, code: string) => crypto.createHmac("sha256", env.JWT_REFRESH_SECRET).update(`${userId}:${code}`).digest("hex");

/** New 6-digit code; any older code of the same kind stops working. */
async function issueOtp(userId: string, type: "verify-otp" | "reset-otp"): Promise<string> {
  await AuthToken.deleteMany({ userId, type });
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await AuthToken.create({ userId, type, tokenHash: otpHash(userId, code), expiresAt: new Date(Date.now() + OTP_TTL_MS), attempts: 0 });
  return code;
}

/** True and consumes the code if it matches; a wrong guess counts, and after 5 the code is cancelled. Same error for "no such user" and "wrong code". */
async function consumeOtp(email: string, type: "verify-otp" | "reset-otp", code: string): Promise<string> {
  const user = await User.findOne({ email: email.toLowerCase() });
  const row = user ? await AuthToken.findOne({ userId: user._id, type, expiresAt: { $gt: new Date() } }) : null;
  if (!user || !row) throw new AppError(400, WRONG_CODE, "INVALID_CODE");
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    await row.deleteOne();
    throw new AppError(400, WRONG_CODE, "INVALID_CODE");
  }
  const given = Buffer.from(otpHash(user._id, code));
  const stored = Buffer.from(row.tokenHash);
  if (given.length !== stored.length || !crypto.timingSafeEqual(given, stored)) {
    await AuthToken.updateOne({ _id: row._id }, { $inc: { attempts: 1 } });
    throw new AppError(400, WRONG_CODE, "INVALID_CODE");
  }
  await row.deleteOne();
  return user._id;
}

export async function verifyEmailOtp(email: string, code: string) {
  const userId = await consumeOtp(email, "verify-otp", code);
  await User.updateOne({ _id: userId }, { emailVerified: true });
  await AuthToken.deleteMany({ userId, type: "verify-email" });
  return { verified: true };
}

export async function resetPasswordOtp(input: ResetOtpInput) {
  const userId = await consumeOtp(input.email, "reset-otp", input.otp);
  await User.updateOne({ _id: userId }, { passwordHash: await bcrypt.hash(input.newPassword, 12), emailVerified: true });
  await RefreshToken.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() });
  await AuthToken.deleteMany({ userId, type: "reset-password" });
  return { reset: true };
}

// ---- Continue with Google --------------------------------------------------------------------------------------

/** Asks Google to verify the ID token (signature and expiry), then checks it was issued for OUR app and the e-mail is verified. */
async function verifyGoogleIdToken(idToken: string): Promise<{ email: string; name: string }> {
  if (!env.GOOGLE_CLIENT_ID) throw new AppError(503, "Google sign-in is not set up on the server.", "GOOGLE_NOT_CONFIGURED");
  let p: { aud?: string; iss?: string; email?: string; email_verified?: string | boolean; name?: string };
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!res.ok) throw new Error(`tokeninfo ${res.status}`);
    p = (await res.json()) as typeof p;
  } catch (err) {
    logger.warn({ err }, "Google token could not be verified");
    throw new UnauthorizedError("Google sign-in failed. Try again.");
  }
  const issuerOk = p.iss === "accounts.google.com" || p.iss === "https://accounts.google.com";
  const verified = p.email_verified === true || p.email_verified === "true";
  if (p.aud !== env.GOOGLE_CLIENT_ID || !issuerOk || !p.email || !verified) throw new UnauthorizedError("Google sign-in failed. Try again.");
  const email = p.email.toLowerCase();
  return { email, name: (p.name ?? "").trim() || email.split("@")[0] };
}

async function freeUsername(email: string): Promise<string> {
  const base = (email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 18) || "user").padEnd(3, "0");
  for (let i = 0; i < 6; i++) {
    const candidate = i === 0 ? base : `${base}${crypto.randomInt(1000, 9999)}`;
    if (!(await User.exists({ username: candidate }))) return candidate;
  }
  return `${base}${crypto.randomBytes(3).toString("hex")}`;
}

/**
 * Sign in or sign up with a Google account. The same rules as the e-mail flow apply: permanently banned addresses are refused,
 * and a brand-new account still waits for admin approval when REQUIRE_ADMIN_APPROVAL=true. Google has already confirmed the
 * e-mail address, so no confirmation code is needed.
 */
export async function googleSignIn(input: GoogleInput) {
  const { email, name } = await verifyGoogleIdToken(input.idToken);
  if (await BannedIdentity.exists({ _id: canonicalEmail(email) })) throw new AppError(403, "This email address can't be used on Pacewise.", "ACCOUNT_BANNED");

  let user = await User.findOne({ email });
  if (user) {
    if (user.status === "banned") throw new AppError(403, MESSAGES.banned[1], MESSAGES.banned[0]);
    if (user.status === "pending" || user.status === "rejected") throw new AppError(403, MESSAGES[user.status][1], MESSAGES[user.status][0]);
    if (!user.emailVerified) {
      // The address was registered with a password but never confirmed. Whoever set that password may not own the inbox,
      // so it is replaced by an unusable one now that the real owner has proved it with Google.
      user.emailVerified = true;
      user.passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
      await user.save();
    }
    const tokens = await issueTokenPair(user._id, user.username, input.device);
    return { user: toPublicUser(user), ...tokens };
  }

  const status = env.requireAdminApproval ? "pending" : "active";
  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12); // no password: they sign in with Google, or use "Forgot password"
  user = await User.create({ email, username: await freeUsername(email), passwordHash, name, emailVerified: true, status });
  try {
    await sendMail({ to: user.email, ...welcomeMail(user.name, status === "pending" ? "wait-approval" : "sign-in", env.APP_URL) });
  } catch (err) { logger.error({ err }, "Could not send welcome e-mail"); }
  if (status === "pending") return { user: toPublicUser(user), approvalRequired: true as const };
  const tokens = await issueTokenPair(user._id, user.username, input.device);
  return { user: toPublicUser(user), approvalRequired: false as const, ...tokens };
}

/** "Continue with Google" for the admin app. It never creates an account: only an existing administrator can get in. */
export async function googleAdminSignIn(input: GoogleInput) {
  const { email } = await verifyGoogleIdToken(input.idToken);
  const user = await User.findOne({ email });
  if (!user || user.role !== "admin") throw new AppError(403, "This account is not an administrator.", "NOT_ADMIN");
  if (user.status === "banned") throw new AppError(403, MESSAGES.banned[1], MESSAGES.banned[0]);
  if (user.status === "pending" || user.status === "rejected") throw new AppError(403, MESSAGES[user.status][1], MESSAGES[user.status][0]);
  const tokens = await issueTokenPair(user._id, user.username, input.device);
  return { user: toPublicUser(user), ...tokens };
}
