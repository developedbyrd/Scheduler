import jwt, { SignOptions } from "jsonwebtoken";
import { config } from "../config/config.ts";

type JwtPayload = Record<string, unknown>;

export type AccessTokenPayload = {
  sub: string;
  email?: string;
};

export type RefreshTokenPayload = {
  sub: string;
  jti: string;
};

if (!config.jwtAccessSecret) {
  throw new Error("JWT_ACCESS_SECRET is missing");
}
if (!config.jwtRefreshSecret) {
  throw new Error("JWT_REFRESH_SECRET is missing");
}

const accessSecret: string = config.jwtAccessSecret;
const refreshSecret: string = config.jwtRefreshSecret;

const accessSignOptions: SignOptions = {
  expiresIn: config.jwtAccessExpiresIn as SignOptions["expiresIn"],
};

const refreshSignOptions: SignOptions = {
  expiresIn: config.jwtRefreshExpiresIn as SignOptions["expiresIn"],
};

export const signAccessToken = (payload: AccessTokenPayload): string => {
  return jwt.sign(
    payload as JwtPayload,
    accessSecret,
    accessSignOptions,
  ) as string;
};

export const signRefreshToken = (payload: RefreshTokenPayload): string => {
  return jwt.sign(
    payload as JwtPayload,
    refreshSecret,
    refreshSignOptions,
  ) as string;
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  return jwt.verify(token, accessSecret) as AccessTokenPayload;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  return jwt.verify(token, refreshSecret) as RefreshTokenPayload;
};
