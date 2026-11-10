import { Notification } from "@/models";
import { redis, redisSub } from "@/config/redis";
import { localEventBus } from "@/utils/eventBus";

const EVENT_CHANNEL = "notifications:events";

interface NewNotificationInput {
  recipientId: string;
  senderId: string;
  type: "FOLLOW" | "LIKE" | "COMMENT" | "SHARE";
  message: string;
  storyId?: string;
}

/** Saves the notification in MongoDB, then fans it out live: through Redis
 *  pub/sub when configured (multi-instance), else directly in-process. */
export async function publishEvent(input: NewNotificationInput) {
  if (input.recipientId === input.senderId) return null;
  const doc = await Notification.create(input);
  const json = doc.toJSON();
  if (redis) await redis.publish(EVENT_CHANNEL, JSON.stringify(json));
  else localEventBus.emit("notification", json);
  return json;
}

/** Called once at boot. With Redis: subscribe. Without: nothing to do (publishEvent emits locally). */
export function subscribeToEvents(onEvent: (notification: unknown) => void): void {
  if (!redisSub) return;
  redisSub.subscribe(EVENT_CHANNEL);
  redisSub.on("message", (channel, message) => {
    if (channel !== EVENT_CHANNEL) return;
    try { onEvent(JSON.parse(message)); } catch { /* drop malformed payload */ }
  });
}

export async function listNotifications(userId: string, cursor?: string, take = 20) {
  const where: Record<string, unknown> = { recipientId: userId };
  if (cursor) {
    const c = await Notification.findById(cursor).select("createdAt").lean();
    if (c) where.createdAt = { $lt: c.createdAt };
  }
  const rows = await Notification.find(where).sort({ createdAt: -1 }).limit(take).lean();
  return rows.map(({ _id, ...r }) => ({ id: _id, ...r }));
}

export async function markRead(userId: string, notificationId: string): Promise<void> {
  await Notification.updateOne({ _id: notificationId, recipientId: userId }, { read: true });
}
export async function markAllRead(userId: string): Promise<void> {
  await Notification.updateMany({ recipientId: userId, read: false }, { read: true });
}
export async function unreadCount(userId: string): Promise<number> {
  return Notification.countDocuments({ recipientId: userId, read: false });
}
