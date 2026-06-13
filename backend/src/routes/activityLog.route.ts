import express from "express";
import { requireAccessToken } from "../middlewares/auth.middleware.ts";
import { getActivity } from "../controllers/activityLog.controller.ts";

const activityLogRouter = express.Router();

activityLogRouter.get("/", requireAccessToken, getActivity);

export default activityLogRouter;
