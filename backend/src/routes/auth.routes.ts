import { Router } from "express";
import {
  loginUser,
  refreshAccessToken,
  registerUser,
} from "../controllers/auth.controller.ts";

const authRouter = Router();

authRouter.post("/register", registerUser);
authRouter.post("/login", loginUser);
authRouter.post("/refresh", refreshAccessToken);

export default authRouter;
