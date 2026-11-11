import { Router } from "express";
import * as historyController from "@/modules/history/history.controller";
import { requireAuth } from "@/middleware/auth";
import { rateLimit } from "@/middleware/rateLimit";
import { validate } from "@/middleware/validate";
import { createSessionSchema, highlightsQuerySchema, listSessionsQuerySchema, sessionIdParamSchema, updateTopicsSchema } from "@/modules/history/history.schema";

export const historyRouter = Router();

historyRouter.use(requireAuth);

historyRouter.post("/", validate({ body: createSessionSchema }), historyController.create);
historyRouter.get("/", validate({ query: listSessionsQuerySchema }), historyController.list);
historyRouter.get("/stats", historyController.stats);
historyRouter.get("/highlights", validate({ query: highlightsQuerySchema }), historyController.highlights);
historyRouter.get("/weekly-report", historyController.weeklyReport);
historyRouter.post("/weekly-report/send", rateLimit({ windowSeconds: 3600, max: 3, keyPrefix: "weekly-mail" }), historyController.sendWeeklyReport);
historyRouter.patch("/:id/topics", validate({ params: sessionIdParamSchema, body: updateTopicsSchema }), historyController.updateTopics);
