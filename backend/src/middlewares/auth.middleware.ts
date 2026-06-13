import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../util/token.util.ts";

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
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing Bearer token" });
  }

  const token = header.slice("Bearer ".length).trim();

  try {
    const decoded = verifyAccessToken(token);
    req.user = {
      userId: decoded.sub,
      email: decoded.email,
    };
    return next();
  } catch (_err) {
    return res.status(401).json({ message: "Invalid or expired access token" });
  }
};
