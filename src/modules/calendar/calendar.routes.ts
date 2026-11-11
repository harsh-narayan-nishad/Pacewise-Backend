import { Router } from "express";
import * as calendarController from "@/modules/calendar/calendar.controller";
import { requireAuth } from "@/middleware/auth";
import { validate } from "@/middleware/validate";
import { createEventSchema, eventIdParamSchema, listEventsQuerySchema, updateEventSchema } from "@/modules/calendar/calendar.schema";

export const calendarRouter = Router();

calendarRouter.use(requireAuth);

calendarRouter.get("/events", validate({ query: listEventsQuerySchema }), calendarController.list);
calendarRouter.post("/events", validate({ body: createEventSchema }), calendarController.create);
calendarRouter.patch("/events/:id", validate({ params: eventIdParamSchema, body: updateEventSchema }), calendarController.update);
calendarRouter.delete("/events/:id", validate({ params: eventIdParamSchema }), calendarController.remove);
