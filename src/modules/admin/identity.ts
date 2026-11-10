/**
 * Pure helpers (no database) so they can be unit-tested.
 */

/** One canonical form per real inbox: lower-case, "+tag" removed, and for Gmail also the dots. */
export function canonicalEmail(email: string): string {
  const [localRaw, domainRaw = ""] = email.trim().toLowerCase().split("@");
  let domain = domainRaw;
  let local = localRaw.split("+")[0];
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

/** Seen within 2 minutes = online (the app talks to the API every ~15 s while open), within 15 minutes = idle. */
export const ONLINE_MS = 2 * 60 * 1000;
export const IDLE_MS = 15 * 60 * 1000;
export type Presence = "online" | "idle" | "offline";

export function presenceOf(lastSeenAt: Date | string | null | undefined, now = Date.now()): Presence {
  if (!lastSeenAt) return "offline";
  const age = now - new Date(lastSeenAt).getTime();
  if (age <= ONLINE_MS) return "online";
  if (age <= IDLE_MS) return "idle";
  return "offline";
}

export type Status = "pending" | "active" | "rejected" | "banned";
export type AdminAction = "approve" | "reject" | "ban" | "unban" | "make-admin" | "remove-admin" | "revoke-sessions";

export interface Subject { id: string; status: Status; role: "user" | "admin" }

/** What an admin may do to whom. Returns an error message, or null when allowed. */
export function checkAdminAction(action: AdminAction, actor: { id: string }, target: Subject, adminCount: number): string | null {
  const self = actor.id === target.id;
  switch (action) {
    case "approve":
      return target.status === "pending" || target.status === "rejected" ? null : "Only pending or declined accounts can be approved.";
    case "reject":
      return target.status === "pending" ? null : "Only pending accounts can be declined.";
    case "ban":
      if (self) return "You cannot ban yourself.";
      if (target.role === "admin") return "Remove admin rights first, then ban.";
      return target.status === "banned" ? "Already banned." : null;
    case "unban":
      return target.status === "banned" ? null : "This account is not banned.";
    case "make-admin":
      if (target.role === "admin") return "Already an admin.";
      return target.status === "active" ? null : "Only active accounts can become admins.";
    case "remove-admin":
      if (target.role !== "admin") return "Not an admin.";
      if (self) return "You cannot remove your own admin rights.";
      return adminCount <= 1 ? "There must always be at least one admin." : null;
    case "revoke-sessions":
      return null;
  }
}
