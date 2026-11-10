import { Request, Response } from "express";
import * as notificationsService from "@/modules/notifications/notifications.service";
import { asyncHandler } from "@/utils/asyncHandler";
import { UnauthorizedError } from "@/utils/AppError";
import { localEventBus } from "@/utils/eventBus";

export const list = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
  const items = await notificationsService.listNotifications(req.user.id, cursor);
  res.json({ items, unreadCount: await notificationsService.unreadCount(req.user.id) });
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  await notificationsService.markRead(req.user.id, req.params.id);
  res.status(204).send();
});

export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  await notificationsService.markAllRead(req.user.id);
  res.status(204).send();
});

/**
 * Server-Sent Events stream: one long-lived HTTP response per connected
 * client, fed by the Redis pub/sub subscription set up in src/server.ts.
 * Chosen over WebSockets deliberately — SSE is plain HTTP (works through
 * any load balancer/proxy with zero special config, and both a browser
 * `EventSource` and a mobile HTTP client can consume it), is one-directional
 * (all this feature needs: server → client push), and auto-reconnects on
 * the client side natively. A mobile app that can't use `EventSource`
 * directly can still poll GET /notifications on an interval instead —
 * this stream is a nice-to-have layered on top of that, not a dependency.
 */
export const stream = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const userId = req.user.id;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(`event: connected\ndata: {}\n\n`);

  const onNotification = (notification: { recipientId: string }): void => {
    if (notification.recipientId !== userId) return;
    res.write(`event: notification\ndata: ${JSON.stringify(notification)}\n\n`);
  };
  localEventBus.on("notification", onNotification);

  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    localEventBus.off("notification", onNotification);
  });
});
