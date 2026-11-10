import { Router } from "express";
import * as usersController from "@/modules/users/users.controller";
import { requireAuth } from "@/middleware/auth";
import { validate } from "@/middleware/validate";
import { updateProfileSchema, usernameParamSchema } from "@/modules/users/users.schema";

export const usersRouter = Router();

usersRouter.get("/", requireAuth, usersController.listDirectory);
usersRouter.get("/:username", validate({ params: usernameParamSchema }), usersController.getProfile);
usersRouter.patch("/me", requireAuth, validate({ body: updateProfileSchema }), usersController.updateMe);
usersRouter.post("/:username/follow", requireAuth, validate({ params: usernameParamSchema }), usersController.followUser);
usersRouter.delete("/:username/follow", requireAuth, validate({ params: usernameParamSchema }), usersController.unfollowUser);
