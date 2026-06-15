import crypto from "crypto";
import bcrypt from "bcrypt";
import { Types } from "mongoose";
import { User } from "../models/user.model.ts";
import { RefreshToken } from "../models/RefreshToken.model.ts";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../util/token.util.ts";
import { config } from "../config/config.ts";

const hashRefreshToken = (token: string) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const refreshTokenExpiryMs = () => {
  const raw = config.jwtRefreshExpiresIn as string;
  const match = /^(\d+)([smhd])$/.exec(raw);
  if (!match) return 7 * 24 * 60 * 60 * 1000;

  const value = Number(match[1]);
  const unit = match[2];

  switch (unit) {
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
};

export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
};

export const authService = {
  async register({ name, email, password }: RegisterPayload) {
    const userExist = await User.exists({ email });
    if (userExist) {
      const err = new Error("User already exists");
      (err as any).statusCode = 400;
      throw err;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      zernioProfileId: "pending",
    });

    return { _id: user._id, name: user.name, email: user.email };
  },

  async login(params: { email: string; password: string }) {
    const user = await User.findOne({ email: params.email });
    if (!user) {
      const err = new Error("Invalid credentials");
      (err as any).statusCode = 401;
      throw err;
    }

    const isMatch = await bcrypt.compare(params.password, user.password);
    if (!isMatch) {
      const err = new Error("Invalid credentials");
      (err as any).statusCode = 401;
      throw err;
    }

    const accessToken = signAccessToken({
      sub: String(user._id),
      email: user.email,
    });

    const refreshTokenJti = new Types.ObjectId().toString();
    const refreshToken = signRefreshToken({
      sub: String(user._id),
      jti: refreshTokenJti,
    });

    const tokenHash = await hashRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + refreshTokenExpiryMs());

    await RefreshToken.create({
      userId: user._id,
      tokenHash,
      jti: refreshTokenJti,
      expiresAt,
      revokedAt: null,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
      },
    };
  },

  async refresh(params: { refreshToken: string }) {
    const decoded = verifyRefreshToken(params.refreshToken);

    const { sub: userId, jti } = decoded as {
      sub: string;
      jti: string;
    };

    const tokenHash = await hashRefreshToken(params.refreshToken);

    const existing = await RefreshToken.findOne({
      userId,
      jti,
      tokenHash,
      revokedAt: null,
    });

    if (!existing) {
      const err = new Error("Invalid refresh token");
      (err as any).statusCode = 401;
      throw err;
    }

    if (existing.expiresAt.getTime() < Date.now()) {
      await RefreshToken.updateOne(
        { _id: existing._id },
        { revokedAt: new Date() },
      );
      const err = new Error("Refresh token expired");
      (err as any).statusCode = 401;
      throw err;
    }

    // Rotate: revoke old and issue new
    existing.revokedAt = new Date();
    await existing.save();

    const accessToken = signAccessToken({
      sub: String(userId),
    });

    const newJti = new Types.ObjectId().toString();
    const newRefreshToken = signRefreshToken({
      sub: String(userId),
      jti: newJti,
    });

    const newTokenHash = await hashRefreshToken(newRefreshToken);
    const newExpiresAt = new Date(Date.now() + refreshTokenExpiryMs());

    await RefreshToken.create({
      userId,
      tokenHash: newTokenHash,
      jti: newJti,
      expiresAt: newExpiresAt,
      revokedAt: null,
    });

    return { accessToken, refreshToken: newRefreshToken };
  },
};
