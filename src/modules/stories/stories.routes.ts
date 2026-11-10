import { Router } from "express";
import * as storiesController from "@/modules/stories/stories.controller";
import { requireAuth } from "@/middleware/auth";
import { validate } from "@/middleware/validate";
import {
  createStorySchema,
  listStoriesQuerySchema,
  storyIdParamSchema,
  updateStorySchema,
} from "@/modules/stories/stories.schema";

export const storiesRouter = Router();

storiesRouter.get("/", validate({ query: listStoriesQuerySchema }), storiesController.list);
storiesRouter.get("/:id", validate({ params: storyIdParamSchema }), storiesController.getOne);
storiesRouter.post("/", requireAuth, validate({ body: createStorySchema }), storiesController.create);
storiesRouter.patch(
  "/:id",
  requireAuth,
  validate({ params: storyIdParamSchema, body: updateStorySchema }),
  storiesController.update
);
storiesRouter.delete("/:id", requireAuth, validate({ params: storyIdParamSchema }), storiesController.remove);
