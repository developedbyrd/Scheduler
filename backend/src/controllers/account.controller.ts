import { Request, Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.ts";
import { Account } from "../models/account.model.ts";
import zernio from "../config/zernio.config.ts";

export const getAccounts = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<Response> => {
  try {
    const accounts = await Account.find({ user: req.user?.userId });
    return res.json(accounts);
  } catch (error: any) {
    return res
      .status(500)
      .json({ message: error?.message || "Internal Server Error" });
  }
};

export const addAccount = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<Response> => {
  try {
    const { platform, handle, avatarUrl } = req.body as any;
    const accounts = await Account.create({
      user: req.user!.userId,
      platform,
      handle,
      avatarUrl,
    });
    return res.status(201).json(accounts);
  } catch (error: any) {
    return res
      .status(500)
      .json({ message: error?.message || "Internal Server Error" });
  }
};

export const disconnectAccount = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<Response> => {
  try {
    const account = await Account.findOne({
      _id: req.params.id,
      user: req.user?.userId,
    });

    if (!account) {
      return res.status(404).json({
        message: "Account not found",
      });
    }

    if (account.zernioAccountId) {
      await zernio.accounts.deleteAccount({
        path: {
          accountId: account.zernioAccountId,
        },
      });
    }

    await account.deleteOne();

    return res.json({
      message: "Account disconnected successfully",
    });
  } catch (error: any) {
    return res.status(500).json({
      message:
        (error?.response?.data?.message as string) ||
        (error?.message as string) ||
        "Internal Server Error",
    });
  }
};
