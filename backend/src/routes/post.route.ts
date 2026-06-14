import { Router } from "express";
import {
  generatePost,
  getGenerations,
  getPosts,
  schedulePost,
} from "../controllers/post.controller.ts";
import { requireAccessToken } from "../middlewares/auth.middleware.ts";
import multer from "multer";

const postRouter = Router();

// Protect all post routes – the controller expects an authenticated user.
postRouter.use(requireAccessToken);

// Multer middleware to handle multipart/form-data (used for scheduling posts with optional media).
const upload = multer();

// list scheduled/published posts for the authenticated user
postRouter.get("/", getPosts);

// generate content + optional image (no scheduler DB write)
postRouter.post("/generate", generatePost);

// schedule a post for future publishing
// Use `upload.single('media')` to parse the multipart body; the controller will read fields from `req.body`.
postRouter.post("/schedule", upload.single('media'), schedulePost);

// list past generations for the authenticated user
postRouter.get("/generations", getGenerations);

export default postRouter;
