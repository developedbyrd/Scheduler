import express from "express";
import { requireAccessToken } from "../middlewares/auth.middleware.ts";
import {
  addAccount,
  disconnectAccount,
  getAccounts,
} from "../controllers/account.controller.ts";

const accountRouter = express.Router();

accountRouter.get("/", requireAccessToken, getAccounts);
accountRouter.post("/", requireAccessToken, addAccount);
accountRouter.delete("/:id", requireAccessToken, disconnectAccount);

export default accountRouter;
