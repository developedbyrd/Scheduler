import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { config } from "./config/config.ts";
import { ConnectDB } from "./config/db.config.ts";
import { error } from "console";

const app = express();

await ConnectDB();

// Middleware
app.use(cors());
app.use(express.json());

const port = config.port;

app.get("/", (_req: Request, res: Response) => {
  res.send("Server is Live!");
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json(err?.response?.data?.message || err?.message);
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
