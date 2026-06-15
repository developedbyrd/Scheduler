import dotenv from "dotenv";
import path from "path";

const envFile = `.env.${process.env.NODE_ENV ?? "development"}`;
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

export const config = {
  port: process.env.PORT ? Number(process.env.PORT) : 4000,
  mongoDbURI: process.env.MONGODB_URI,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? "",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? "",
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  nodeEnv: process.env.NODE_ENV ?? "development",
  frontendOrigin: process.env.FRONTEND_ORIGIN,
  zernioApiKey: process.env.ZERNIO_API_KEY ?? "",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  renderUrl: process.env.RENDER_URL ?? "",
};

export default config;