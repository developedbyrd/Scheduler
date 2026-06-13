import express from "express";
import {
  generateAuthUrl,
  syncAccounts,
} from "../controllers/socialAuth.controller.ts";
import { requireAccessToken } from "../middlewares/auth.middleware.ts";

const socialAuthRouter = express.Router();

socialAuthRouter.get("/:platform/url", requireAccessToken, generateAuthUrl);
socialAuthRouter.get("/sync", requireAccessToken, syncAccounts);

export default socialAuthRouter;
