import { Router } from "express";
import * as historyController from "@/modules/history/history.controller";
import { requireAuth } from "@/middleware/auth";
import { validate } from "@/middleware/validate";
import { createSessionSchema, listSessionsQuerySchema } from "@/modules/history/history.schema";

export const historyRouter = Router();

historyRouter.use(requireAuth);

historyRouter.post("/", validate({ body: createSessionSchema }), historyController.create);
historyRouter.get("/", validate({ query: listSessionsQuerySchema }), historyController.list);
historyRouter.get("/stats", historyController.stats);
