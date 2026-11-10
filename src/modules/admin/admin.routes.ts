import { Router } from "express";
import * as c from "@/modules/admin/admin.controller";
import { requireAdmin } from "@/middleware/auth";
import { validate } from "@/middleware/validate";
import { rateLimit } from "@/middleware/rateLimit";
import { loginSchema } from "@/modules/auth/auth.schema";
import { auditQuery, banBody, bulkApproveBody, idParam, listReportsQuery, listUsersQuery, overviewQuery, reasonBody, removeContentBody, updateReportBody } from "@/modules/admin/admin.schema";

export const adminRouter = Router();

// Sign-in: same limits as the app's login, plus a per-account cap.
adminRouter.post(
  "/login",
  rateLimit({ windowSeconds: 60, max: 20, keyPrefix: "admin-login-ip" }),
  rateLimit({ windowSeconds: 15 * 60, max: 10, keyPrefix: "admin-login-id", key: (req) => String(req.body?.identifier ?? "").toLowerCase() }),
  validate({ body: loginSchema }),
  c.login
);

// Everything below needs a signed-in administrator.
adminRouter.use(requireAdmin, rateLimit({ windowSeconds: 60, max: 240, keyPrefix: "admin" }));

adminRouter.get("/metrics/overview", validate({ query: overviewQuery }), c.overview);

adminRouter.get("/users", validate({ query: listUsersQuery }), c.listUsers);
adminRouter.post("/users/bulk-approve", validate({ body: bulkApproveBody }), c.bulkApprove);
adminRouter.get("/users/:id", validate({ params: idParam }), c.getUser);
adminRouter.post("/users/:id/approve", validate({ params: idParam }), c.userAction("approve"));
adminRouter.post("/users/:id/reject", validate({ params: idParam, body: reasonBody }), c.userAction("reject"));
adminRouter.post("/users/:id/ban", validate({ params: idParam, body: banBody }), c.userAction("ban"));
adminRouter.post("/users/:id/unban", validate({ params: idParam, body: reasonBody }), c.userAction("unban"));
adminRouter.post("/users/:id/make-admin", validate({ params: idParam, body: reasonBody }), c.userAction("make-admin"));
adminRouter.post("/users/:id/remove-admin", validate({ params: idParam, body: reasonBody }), c.userAction("remove-admin"));
adminRouter.post("/users/:id/revoke-sessions", validate({ params: idParam, body: reasonBody }), c.userAction("revoke-sessions"));

adminRouter.get("/reports", validate({ query: listReportsQuery }), c.listReports);
adminRouter.patch("/reports/:id", validate({ params: idParam, body: updateReportBody }), c.updateReport);
adminRouter.post("/content/remove", validate({ body: removeContentBody }), c.removeContent);

adminRouter.get("/audit", validate({ query: auditQuery }), c.listAudit);
