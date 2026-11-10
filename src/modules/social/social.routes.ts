import { Router } from "express";
import * as socialController from "@/modules/social/social.controller";
import { requireAuth } from "@/middleware/auth";
import { validate } from "@/middleware/validate";
import { commentIdParamSchema, commentSchema, reactionSchema, shareSchema, storyIdParamSchema } from "@/modules/social/social.schema";

export const socialRouter = Router();

socialRouter.put(
  "/stories/:storyId/reaction",
  requireAuth,
  validate({ params: storyIdParamSchema, body: reactionSchema }),
  socialController.react
);
socialRouter.delete(
  "/stories/:storyId/reaction",
  requireAuth,
  validate({ params: storyIdParamSchema }),
  socialController.clearReaction
);

socialRouter.get("/stories/:storyId/comments", validate({ params: storyIdParamSchema }), socialController.listComments);
socialRouter.post(
  "/stories/:storyId/comments",
  requireAuth,
  validate({ params: storyIdParamSchema, body: commentSchema }),
  socialController.addComment
);
socialRouter.delete(
  "/comments/:commentId",
  requireAuth,
  validate({ params: commentIdParamSchema }),
  socialController.deleteComment
);

socialRouter.post(
  "/stories/:storyId/share",
  requireAuth,
  validate({ params: storyIdParamSchema, body: shareSchema }),
  socialController.share
);
socialRouter.put(
  "/stories/:storyId/bookmark",
  requireAuth,
  validate({ params: storyIdParamSchema }),
  socialController.toggleBookmark
);
