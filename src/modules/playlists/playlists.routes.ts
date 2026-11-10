import { Router } from "express";
import * as playlistsController from "@/modules/playlists/playlists.controller";
import { optionalAuth, requireAuth } from "@/middleware/auth";
import { validate } from "@/middleware/validate";
import {
  addItemSchema,
  createPlaylistSchema,
  playlistIdParamSchema,
  playlistItemParamSchema,
  updatePlaylistSchema,
  userIdParamSchema,
} from "@/modules/playlists/playlists.schema";

export const playlistsRouter = Router();

// A public playlist is readable by anyone, including a signed-out visitor
// (e.g. from a profile page) — so GET routes use optionalAuth (identifies
// the caller if there's a token, never rejects without one) instead of the
// blanket requireAuth every mutating route below still needs.
playlistsRouter.get("/public/:userId", validate({ params: userIdParamSchema }), playlistsController.listPublic);
playlistsRouter.get("/:id", optionalAuth, validate({ params: playlistIdParamSchema }), playlistsController.getOne);

playlistsRouter.get("/", requireAuth, playlistsController.list);
playlistsRouter.post("/", requireAuth, validate({ body: createPlaylistSchema }), playlistsController.create);
playlistsRouter.patch(
  "/:id",
  requireAuth,
  validate({ params: playlistIdParamSchema, body: updatePlaylistSchema }),
  playlistsController.update
);
playlistsRouter.delete("/:id", requireAuth, validate({ params: playlistIdParamSchema }), playlistsController.remove);
playlistsRouter.post(
  "/:id/items",
  requireAuth,
  validate({ params: playlistIdParamSchema, body: addItemSchema }),
  playlistsController.addItem
);
playlistsRouter.delete(
  "/:id/items/:storyId",
  requireAuth,
  validate({ params: playlistItemParamSchema }),
  playlistsController.removeItem
);
