import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { config } from "./config/config.ts";
import { ConnectDB } from "./config/db.config.ts";
import authRouter from "./routes/auth.routes.ts";
import socialAuthRouter from "./routes/socialAuth.route.ts";

const app = express();

await ConnectDB();

app.use(cors());
app.use(express.json());

const port = config.port;

app.get("/", (_req: Request, res: Response) => {
  res.send("Server is Live!");
});

app.use("/api/auth", authRouter);
app.use("/api/oauth", socialAuthRouter);

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json(err?.response?.data?.message || err?.message);
});

app.listen(port, () => {
  console.log(`Server is running at ${port}`);
});
