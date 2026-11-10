import { Router } from "express";
import * as notificationsController from "@/modules/notifications/notifications.controller";
import { requireAuth } from "@/middleware/auth";

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);
notificationsRouter.get("/", notificationsController.list);
notificationsRouter.get("/stream", notificationsController.stream);
notificationsRouter.post("/:id/read", notificationsController.markRead);
notificationsRouter.post("/read-all", notificationsController.markAllRead);
