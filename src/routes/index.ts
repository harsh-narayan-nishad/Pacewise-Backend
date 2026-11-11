import { Router } from "express";
import { authRouter } from "@/modules/auth/auth.routes";
import { usersRouter } from "@/modules/users/users.routes";
import { storiesRouter } from "@/modules/stories/stories.routes";
import { socialRouter } from "@/modules/social/social.routes";
import { notificationsRouter } from "@/modules/notifications/notifications.routes";
import { playlistsRouter } from "@/modules/playlists/playlists.routes";
import { historyRouter } from "@/modules/history/history.routes";
import { calendarRouter } from "@/modules/calendar/calendar.routes";
import { syncRouter } from "@/modules/sync/sync.routes";
import { trackingRouter } from "@/modules/tracking/tracking.routes";
import { uploadsRouter } from "@/modules/uploads/uploads.routes";
import { adminRouter } from "@/modules/admin/admin.routes";
import { reportsRouter } from "@/modules/reports/reports.routes";

// Every route lives under /api/v1 — versioning from day one so a future
// breaking change (a v2) can run side by side with v1 instead of forcing
// every client (web, iOS, Android, whatever comes next) to upgrade in
// lockstep the moment the API changes.
export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => res.json({ status: "ok", uptime: process.uptime() }));
apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/stories", storiesRouter);
// social.routes.ts already nests its own "/stories/:storyId/..." and
// "/comments/:commentId" paths, so it's mounted at the API root rather
// than under "/stories" a second time.
apiRouter.use("/", socialRouter);
apiRouter.use("/notifications", notificationsRouter);
apiRouter.use("/playlists", playlistsRouter);
apiRouter.use("/history", historyRouter);
apiRouter.use("/calendar", calendarRouter);
apiRouter.use("/uploads", uploadsRouter);
apiRouter.use("/sync", syncRouter);
apiRouter.use("/tracking", trackingRouter);
apiRouter.use("/reports", reportsRouter);
apiRouter.use("/admin", adminRouter);
