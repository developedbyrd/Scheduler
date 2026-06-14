import { Router } from "express";
import {
  loginUser,
  refreshAccessToken,
  registerUser,
  logoutUser,
} from "../controllers/auth.controller.ts";

const authRouter = Router();

authRouter.post("/register", registerUser);
authRouter.post("/login", loginUser);
authRouter.post("/refresh", refreshAccessToken);
authRouter.post("/logout", logoutUser);

export default authRouter;
