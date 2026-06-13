import { Request, Response } from "express";
import { Account } from "../models/account.model.ts";

export const getAccounts = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const accounts = await Account.find({ user: req.user._id });
    res.json(accounts);
  } catch (error) {
    res
      .status(500)
      .json({ message: error?.message || "Internal Server Error" });
  }
};

export const addAccount = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { platform, handle, avatarUrl } = req.body;
    const accounts = await Account.create({
      user: req.user._id,
      platform,
      handle,
      avatarUrl,
    });
    res.status(201).json(accounts);
  } catch (error) {
    res
      .status(500)
      .json({ message: error?.message || "Internal Server Error" });
  }
};

export const disconnectAccount = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const account = await Account.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!account) {
      res.status(404).json({ message: "Account not found" });
      return;
    }

    if (account.zernioAccountId) {
      try {
        await zernio.accounts.deleteAccount({
          path: { accountId: account.zernioAccountId },
        });
      } catch (error) {
        res
          .status(500)
          .json({ message: error?.response?.data?.message || error?.message });
        return;
      }
    }

    await account.deleteOne();
    res.json({ message: "Account disconnected successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: error?.message || "Internal Server Error" });
  }
};
