import { Router } from "express";
import * as usersController from "@/modules/users/users.controller";
import { requireAuth } from "@/middleware/auth";
import { validate } from "@/middleware/validate";
import { relationsQuerySchema, updateProfileSchema, userIdParamSchema, usernameParamSchema } from "@/modules/users/users.schema";

export const usersRouter = Router();

usersRouter.get("/", requireAuth, usersController.listDirectory);
// Anyone can see who follows a person and who they follow (public fields only).
usersRouter.get("/:id/followers", validate({ params: userIdParamSchema, query: relationsQuerySchema }), usersController.listFollowers);
usersRouter.get("/:id/following", validate({ params: userIdParamSchema, query: relationsQuerySchema }), usersController.listFollowing);
usersRouter.get("/:username", validate({ params: usernameParamSchema }), usersController.getProfile);
usersRouter.patch("/me", requireAuth, validate({ body: updateProfileSchema }), usersController.updateMe);
usersRouter.post("/:username/follow", requireAuth, validate({ params: usernameParamSchema }), usersController.followUser);
usersRouter.delete("/:username/follow", requireAuth, validate({ params: usernameParamSchema }), usersController.unfollowUser);
