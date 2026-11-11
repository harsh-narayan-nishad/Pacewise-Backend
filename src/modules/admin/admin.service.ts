import { AuditLog, BannedIdentity, Comment, Bookmark, Reaction, RefreshToken, Report, Story, User } from "@/models";
import { AppError, NotFoundError } from "@/utils/AppError";
import { env } from "@/config/env";
import { logger } from "@/config/logger";
import { accountApprovedMail, accountDeclinedMail, sendMail } from "@/utils/mailer";
import * as authService from "@/modules/auth/auth.service";
import { forgetAccount } from "@/modules/admin/accountGuard";
import { AdminAction, canonicalEmail, checkAdminAction, IDLE_MS, ONLINE_MS, presenceOf, Status } from "@/modules/admin/identity";
import type { ListUsersQuery } from "@/modules/admin/admin.schema";

export interface Actor { id: string; username: string }

const realUsers = (includeDemo: boolean) => (includeDemo ? {} : { isDemoUser: { $ne: true } });
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function audit(actor: Actor, action: string, targetType: string, targetId: string, targetLabel = "", note = "") {
  await AuditLog.create({ actorId: actor.id, actorName: actor.username, action, targetType, targetId, targetLabel, note });
}

type UserRow = { _id: string; username: string; name: string; email: string; status?: string | null; role?: string | null; emailVerified?: boolean | null; isDemoUser?: boolean | null; createdAt?: Date; lastSeenAt?: Date | null; statusNote?: string | null; statusChangedAt?: Date | null };
const toRow = (u: UserRow) => ({
  id: u._id, username: u.username, name: u.name, email: u.email,
  status: (u.status ?? "active") as Status, role: u.role === "admin" ? "admin" : "user",
  emailVerified: u.emailVerified ?? false, isDemoUser: u.isDemoUser ?? false,
  createdAt: u.createdAt, lastSeenAt: u.lastSeenAt ?? null, presence: presenceOf(u.lastSeenAt),
  statusNote: u.statusNote ?? "", statusChangedAt: u.statusChangedAt ?? null,
});

// ---- Admin sign-in ----------------------------------------------------------------------------------------------
/** Same credentials check as the app (rate limits, bcrypt), but only administrators get a session. */
export async function adminLogin(input: Parameters<typeof authService.login>[0]) {
  const result = await authService.login(input);
  if (result.user.role !== "admin") {
    await authService.logout(result.refreshToken);
    throw new AppError(403, "This account is not an administrator.", "NOT_ADMIN");
  }
  return result;
}

export async function adminGoogleLogin(input: Parameters<typeof authService.googleAdminSignIn>[0]) {
  return authService.googleAdminSignIn(input);
}

// ---- Metrics ----------------------------------------------------------------------------------------------------
export async function overview(includeDemo: boolean) {
  const base = realUsers(includeDemo);
  const now = Date.now();
  const since = (ms: number) => new Date(now - ms);
  const day = 24 * 60 * 60 * 1000;
  const count = (extra: Record<string, unknown>) => User.countDocuments({ ...base, ...extra });
  const activeStatus = { status: { $nin: ["pending", "rejected", "banned"] } };

  const [total, active, pending, rejected, banned, admins, verified, online, idle, today, week, month, signupRows, stories, comments, reactions, reportRows, newToday] = await Promise.all([
    count({}),
    count(activeStatus),
    count({ status: "pending" }),
    count({ status: "rejected" }),
    count({ status: "banned" }),
    count({ role: "admin" }),
    count({ emailVerified: true }),
    count({ lastSeenAt: { $gte: since(ONLINE_MS) } }),
    count({ lastSeenAt: { $gte: since(IDLE_MS), $lt: since(ONLINE_MS) } }),
    count({ lastSeenAt: { $gte: since(day) } }),
    count({ lastSeenAt: { $gte: since(7 * day) } }),
    count({ lastSeenAt: { $gte: since(30 * day) } }),
    User.aggregate<{ _id: string; n: number }>([
      { $match: { ...base, createdAt: { $gte: since(14 * day) } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, n: { $sum: 1 } } },
    ]),
    Story.countDocuments({}),
    Comment.countDocuments({}),
    Reaction.countDocuments({}),
    Report.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    count({ createdAt: { $gte: since(day) } }),
  ]);

  const byDay = new Map(signupRows.map((r) => [r._id, r.n]));
  const signups = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now - (13 - i) * day).toISOString().slice(0, 10);
    return { day: d, count: byDay.get(d) ?? 0 };
  });
  const reports = { open: 0, reviewing: 0, resolved: 0, dismissed: 0 } as Record<string, number>;
  for (const r of reportRows) reports[r._id] = r.n;

  return {
    generatedAt: new Date().toISOString(),
    approvalRequired: env.requireAdminApproval,
    users: { total, active, pending, rejected, banned, admins, verified, unverified: total - verified, newToday },
    // Offline = approved accounts that are neither online nor idle.
    presence: { online, idle, offline: Math.max(0, active - online - idle) },
    activeUsers: { today, last7Days: week, last30Days: month },
    signups,
    content: { stories, comments, reactions },
    reports,
  };
}

// ---- Users ------------------------------------------------------------------------------------------------------
export async function listUsers(q: ListUsersQuery) {
  const now = Date.now();
  const where: Record<string, unknown> = { ...realUsers(q.includeDemo) };
  if (q.status === "active") where.status = { $nin: ["pending", "rejected", "banned"] };
  else if (q.status) where.status = q.status;
  if (q.role) where.role = q.role;
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), "i");
    where.$or = [{ username: rx }, { email: rx }, { name: rx }];
  }
  if (q.presence === "online") where.lastSeenAt = { $gte: new Date(now - ONLINE_MS) };
  else if (q.presence === "idle") where.lastSeenAt = { $gte: new Date(now - IDLE_MS), $lt: new Date(now - ONLINE_MS) };
  else if (q.presence === "offline") where.$and = [{ $or: [{ lastSeenAt: { $lt: new Date(now - IDLE_MS) } }, { lastSeenAt: null }, { lastSeenAt: { $exists: false } }] }, { status: { $nin: ["pending", "rejected", "banned"] } }];
  const sort = q.sort === "seen" ? { lastSeenAt: -1 as const } : { createdAt: -1 as const };
  const [rows, total] = await Promise.all([
    User.find(where).sort(sort).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    User.countDocuments(where),
  ]);
  return { items: rows.map(toRow), total, page: q.page, limit: q.limit };
}

export async function getUser(id: string) {
  const u = await User.findById(id).lean();
  if (!u) throw new NotFoundError("User");
  const [stories, comments, reportsAgainst, reportsFiled, sessions] = await Promise.all([
    Story.countDocuments({ authorId: id }),
    Comment.countDocuments({ userId: id }),
    Report.countDocuments({ targetOwnerId: id }),
    Report.countDocuments({ reporterId: id }),
    RefreshToken.countDocuments({ userId: id, revokedAt: null, expiresAt: { $gt: new Date() } }),
  ]);
  return { ...toRow(u), interests: u.interests, stats: { stories, comments, reportsAgainst, reportsFiled, activeSessions: sessions } };
}

async function applyAction(actor: Actor, id: string, action: AdminAction, reason = "") {
  const target = await User.findById(id);
  if (!target) throw new NotFoundError("User");
  const adminCount = await User.countDocuments({ role: "admin", status: { $nin: ["banned", "rejected", "pending"] } });
  const status = (target.status ?? "active") as Status;
  const problem = checkAdminAction(action, actor, { id: target._id, status, role: target.role === "admin" ? "admin" : "user" }, adminCount);
  if (problem) throw new AppError(409, problem, "ACTION_NOT_ALLOWED");

  const stamp = { statusChangedAt: new Date(), statusChangedBy: actor.id };
  switch (action) {
    case "approve":
      await User.updateOne({ _id: id }, { $set: { status: "active", statusNote: "", ...stamp } });
      void sendMail({ to: target.email, ...accountApprovedMail(target.name, env.APP_URL) }).catch((err) => logger.error({ err }, "Could not send approval e-mail"));
      break;
    case "reject":
      await User.updateOne({ _id: id }, { $set: { status: "rejected", statusNote: reason, ...stamp } });
      void sendMail({ to: target.email, ...accountDeclinedMail(target.name) }).catch((err) => logger.error({ err }, "Could not send decline e-mail"));
      break;
    case "ban":
      await User.updateOne({ _id: id }, { $set: { status: "banned", statusNote: reason, ...stamp } });
      await BannedIdentity.updateOne({ _id: canonicalEmail(target.email) }, { $set: { email: target.email, userId: id, reason } }, { upsert: true });
      await RefreshToken.updateMany({ userId: id, revokedAt: null }, { revokedAt: new Date() });
      break;
    case "unban":
      await User.updateOne({ _id: id }, { $set: { status: "active", statusNote: "", ...stamp } });
      await BannedIdentity.deleteOne({ _id: canonicalEmail(target.email) });
      break;
    case "make-admin":
      await User.updateOne({ _id: id }, { $set: { role: "admin" } });
      break;
    case "remove-admin":
      await User.updateOne({ _id: id }, { $set: { role: "user" } });
      break;
    case "revoke-sessions":
      await RefreshToken.updateMany({ userId: id, revokedAt: null }, { revokedAt: new Date() });
      break;
  }
  forgetAccount(id);
  await audit(actor, action, "user", id, `@${target.username}`, reason);
  return getUser(id);
}
export const act = applyAction;

export async function bulkApprove(actor: Actor, ids: string[]) {
  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const id of ids) {
    try {
      await applyAction(actor, id, "approve");
      results.push({ id, ok: true });
    } catch (err) {
      results.push({ id, ok: false, error: err instanceof Error ? err.message : "failed" });
    }
  }
  return { results };
}

// ---- Reports ----------------------------------------------------------------------------------------------------
export async function listReports(q: { status?: string; targetType?: string; page: number; limit: number }) {
  const where: Record<string, unknown> = {};
  if (q.status) where.status = q.status;
  if (q.targetType) where.targetType = q.targetType;
  const [rows, total] = await Promise.all([
    Report.find(where).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    Report.countDocuments(where),
  ]);
  const ids = [...new Set(rows.flatMap((r) => [r.reporterId, r.targetOwnerId].filter(Boolean) as string[]))];
  const people = new Map((await User.find({ _id: { $in: ids } }).select("username name status").lean()).map((u) => [u._id, u]));
  const items = rows.map((r) => {
    const reporter = people.get(r.reporterId);
    const owner = r.targetOwnerId ? people.get(r.targetOwnerId) : undefined;
    return {
      id: r._id, targetType: r.targetType, targetId: r.targetId, reason: r.reason, details: r.details, snapshot: r.snapshot,
      status: r.status, resolution: r.resolution, createdAt: r.createdAt, handledAt: r.handledAt ?? null,
      reporter: reporter ? { id: reporter._id, username: reporter.username } : null,
      owner: owner ? { id: owner._id, username: owner.username, name: owner.name, status: owner.status ?? "active" } : null,
    };
  });
  return { items, total, page: q.page, limit: q.limit };
}

export async function updateReport(actor: Actor, id: string, input: { status: "open" | "reviewing" | "resolved" | "dismissed"; resolution?: string }) {
  const done = input.status === "resolved" || input.status === "dismissed";
  const r = await Report.findByIdAndUpdate(id, { $set: { status: input.status, resolution: input.resolution ?? "", handledBy: done ? actor.id : undefined, handledAt: done ? new Date() : undefined } }, { new: true }).lean();
  if (!r) throw new NotFoundError("Report");
  await audit(actor, `report-${input.status}`, "report", id, `${r.targetType}:${r.targetId}`, input.resolution ?? "");
  return { id: r._id, status: r.status };
}

/** Takes down a reported story or comment, and closes every open report about it. */
export async function removeContent(actor: Actor, input: { type: "story" | "comment"; id: string; reportId?: string; reason?: string }) {
  let label = "";
  if (input.type === "story") {
    const s = await Story.findById(input.id).lean();
    if (!s) throw new NotFoundError("Story");
    label = s.title;
    await Promise.all([Story.deleteOne({ _id: input.id }), Comment.deleteMany({ storyId: input.id }), Reaction.deleteMany({ storyId: input.id }), Bookmark.deleteMany({ storyId: input.id })]);
  } else {
    const c = await Comment.findById(input.id).lean();
    if (!c) throw new NotFoundError("Comment");
    label = c.text.slice(0, 60);
    await Comment.deleteOne({ _id: input.id });
  }
  await Report.updateMany({ targetType: input.type, targetId: input.id, status: { $in: ["open", "reviewing"] } }, { $set: { status: "resolved", resolution: "Content removed", handledBy: actor.id, handledAt: new Date() } });
  await audit(actor, `remove-${input.type}`, input.type, input.id, label, input.reason ?? "");
  return { removed: true };
}

// ---- Audit log --------------------------------------------------------------------------------------------------
export async function listAudit(q: { page: number; limit: number }) {
  const [rows, total] = await Promise.all([AuditLog.find({}).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(), AuditLog.countDocuments({})]);
  return { items: rows.map((a) => ({ id: a._id, actorName: a.actorName, action: a.action, targetType: a.targetType, targetId: a.targetId, targetLabel: a.targetLabel, note: a.note, createdAt: a.createdAt })), total, page: q.page, limit: q.limit };
}
