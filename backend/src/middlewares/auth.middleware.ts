import { NextFunction, Response } from "express";
import { verifyAccessToken } from "../util/token.util.ts";

import type { Request } from "express";

export type AuthenticatedRequest = Request & {
  user?: {
    userId: string;
    email?: string;
  };
};

export const requireAccessToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  const token = req.cookies?.accessToken;

  if (!token) {
    return res.status(401).json({ message: "Missing access token cookie" });
  }

  try {
    const decoded = verifyAccessToken(token);
    req.user = {
      userId: decoded.sub,
      email: decoded.email,
    };
    return next();
  } catch (_err) {
    return res
      .status(401)
      .json({ message: "Invalid or expired access token" });
  }
};
