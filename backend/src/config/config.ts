import dotenv from "dotenv";
import path from "path";

const envFile = `.env.${process.env.NODE_ENV ?? "development"}`;
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

export const config = {
  port: process.env.PORT ? Number(process.env.PORT) : 4000,
  mongoDbURI: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET ?? "",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? "",
  nodeEnv: process.env.NODE_ENV ?? "development",
};

export default config;