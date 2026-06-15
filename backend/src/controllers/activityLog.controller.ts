import { Response } from "express";
import { ActivityLog } from "../models/activitylog.model.ts";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.ts";

export const getActivity = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<Response> => {
  try {
    const activity = await ActivityLog.find({ user: req.user?.userId })
      .sort({
        createdAt: -1,
      })
      .limit(10)
      .populate("relatedPost", "content");
    return res.json(activity);
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
