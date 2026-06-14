import { Request, Response } from "express";
import { ActivityLog } from "../models/activitylog.model.ts";

export const getActivity = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const activity = await ActivityLog.find({ user: req.user._id })
      .sort({
        createdAt: -1,
      })
      .limit(10)
      .populate("relatedPost", "content");
    res.json(activity);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};
