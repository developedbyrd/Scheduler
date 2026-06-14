import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { User } from "../models/user.model.ts";
import { authService } from "../services/auth.service.ts";
import { config } from "../config/config.ts";

const isProd = config.nodeEnv === "production";

const accessCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "strict" as const,
  path: "/",
};

const refreshCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "strict" as const,
  path: "/api/v1/auth/refresh",
};

export const registerUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    const userExist = await User.exists({ email });
    if (userExist) {
      res.status(400).json({ message: "User already exists" });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      zernioProfileId: "pending",
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
    });
  } catch (_error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const result = await authService.login({ email, password });

    res.cookie("accessToken", result.accessToken, accessCookieOptions);
    res.cookie("refreshToken", result.refreshToken, refreshCookieOptions);

    res.status(200).json({
      message: "Login successful",
      _id: result.user._id,
      name: result.user.name,
      email: result.user.email,
    });
  } catch (error: any) {
    const status = error?.statusCode ?? 401;
    res.status(status).json({ message: error?.message ?? "Login failed" });
  }
};

export const refreshAccessToken = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      res.status(401).json({ message: "Missing refresh token cookie" });
      return;
    }

    const result = await authService.refresh({ refreshToken });

    res.cookie("accessToken", result.accessToken, accessCookieOptions);
    res.cookie("refreshToken", result.refreshToken, refreshCookieOptions);

    res.status(200).json({ message: "Token refreshed" });
  } catch (error: any) {
    const status = error?.statusCode ?? 401;
    res.status(status).json({
      message: error?.message ?? "Unable to refresh access token",
    });
  }
};

export const logoutUser = async (req: Request, res: Response) => {
  res.clearCookie("accessToken", accessCookieOptions);
  res.clearCookie("refreshToken", refreshCookieOptions);
  res.status(200).json({ message: "Logged out successfully" });
};
