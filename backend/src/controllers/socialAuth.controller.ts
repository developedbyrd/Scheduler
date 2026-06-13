import { Response } from "express";
import zernio from "../config/zernio.config.ts";
import { User } from "../models/user.model.ts";
import { Account } from "../models/account.model.ts";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.ts";

const getOrCreateZernioProfile = async (
  user: AuthenticatedRequest["user"] | undefined,
): Promise<string> => {
  if (!user) {
    throw new Error("Missing authenticated user");
  }

  try {
    const result = await zernio.profiles.listProfiles();
    const data = result.data;
    const profiles = Array.isArray(data)
      ? data
      : data?.profile || data?.data || [];

    if (profiles.length > 0) {
      const pid = profiles[0]._id || profiles[0].id;
      await User.findByIdAndUpdate(user.userId, { zernioProfileId: pid });
      return pid;
    }

    const createResult = await zernio.profiles.createProfile({
      body: { name: `${user.name || user.email}'s workspace` },
    });
    const created = createResult?.profile || createResult?.data;
    const pid = created?._id || created?.id;

    if (!pid) {
      throw new Error("Failed to create zernio profile - no ID returned");
    }

    await User.findByIdAndUpdate(user.userId, { zernioProfileId: pid });
    return pid;
  } catch (error: any) {
    console.error("getOrCreateZernioProfile Error: ", error?.message || error);
    throw error;
  }
};

export const generateAuthUrl = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const { platform } = req.params;
    const profileId = await getOrCreateZernioProfile(req.user);

    const origin = req.headers.origin ?? "";
    const redirectUrl = `${origin}/accounts`;

    const result = await zernio.connect.getConnectUrl({
      path: platform,
      query: {
        profileId,
        redirect_url: redirectUrl,
      },
    });

    const data = result.data;
    console.log("getConnectUrl Connect: ", JSON.stringify(data, null, 2));

    const authUrl = data.authUrl;
    if (!authUrl) {
      throw new Error(
        `Zernio returned no authUrl. Full response: ${JSON.stringify(data)}`,
      );
    }

    res.json({ url: authUrl });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: error?.message || "Internal Server Error" });
  }
};

export const syncAccounts = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const profileId = await getOrCreateZernioProfile(req.user);
    const result = await zernio.accounts.listAccounts({
      query: { profileId },
    });

    const data = result.data;
    const zernioAccounts = data?.accounts || (Array.isArray(data) ? data : []);
    const supportedPlatforms = ["twitter", "linkedin", "facebook", "instagram"];
    const syncedAccounts = [];

    for (const zAccounts of zernioAccounts) {
      const zid = zAccounts._id || zAccounts.id;
      if (!zid) {
        console.warn(`Skipping account with no ID: ${zAccounts}`);
      }

      const rawPlatform = (
        zAccounts.platform ||
        zAccounts.type ||
        ""
      ).toLowerCase();

      const normalizedPlatform = supportedPlatforms.find((p) =>
        rawPlatform.includes(p),
      );

      if (!normalizedPlatform) {
        console.warn(`Skipping unsupported platform: ${rawPlatform}`);
        continue;
      }

      const account = await Account.findOneAndUpdate(
        { zernioAccountId: zid },
        {
          user: req.user.userId,
          platform: supportedPlatforms,
          handle:
            zAccounts.username ||
            zAccounts.name ||
            zAccounts.handle ||
            "Unknown",
          zernioAccountId: zid,
          status: "connected",
          avatarUrl:
            zAccounts.avatarUrl ||
            zAccounts.picture ||
            zAccounts.profile_image_url,
        },
        { upsert: true, returnDocument: "after" },
      );
      syncedAccounts.push(account);
    }

    res.json(syncedAccounts);
  } catch (error: any) {
    res
      .status(500)
      .json({ message: error?.message || "Internal Server Error" });
  }
};
