import { Router } from "express";
import {
  generatePost,
  getGenerations,
  getPosts,
  schedulePost,
} from "../controllers/post.controller.ts";

const postRouter = Router();

// list scheduled/published posts for the authenticated user
postRouter.get("/", getPosts);

// generate content + optional image (no scheduler DB write)
postRouter.post("/generate", generatePost);

// schedule a post for future publishing
postRouter.post("/schedule", schedulePost);

// list past generations for the authenticated user
postRouter.get("/generations", getGenerations);

export default postRouter;
