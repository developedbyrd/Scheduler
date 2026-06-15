import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config/config.ts";
import { ConnectDB } from "./config/db.config.ts";
import authRouter from "./routes/auth.routes.ts";
import socialAuthRouter from "./routes/socialAuth.route.ts";
import accountRouter from "./routes/account.route.ts";
import postRouter from "./routes/post.route.ts";
import activityLogRouter from "./routes/activityLog.route.ts";
import { initScheduler } from "./services/scheduler.service.ts";
import { initKeepAlive } from "./services/keepAlive.service.ts";

const app = express();

await ConnectDB();

app.use(
  cors({
    origin: config.frontendOrigin,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());

app.use("/generated", express.static("public/generated"));

const port = config.port;

app.get("/", (_req: Request, res: Response) => {
  res.send("Server is Live!");
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/oauth", socialAuthRouter);
app.use("/api/v1/accounts", accountRouter);
app.use("/api/v1/posts", postRouter);
app.use("/api/v1/activity", activityLogRouter);

initScheduler();
initKeepAlive();

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json(err?.response?.data?.message || err?.message);
});

app.listen(port, () => {
  console.log(`Server is running at ${port}`);
});
