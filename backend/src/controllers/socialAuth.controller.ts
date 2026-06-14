import { Response } from "express";
import zernio from "../config/zernio.config.ts";
import { User } from "../models/user.model.ts";
import { Account } from "../models/account.model.ts";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.ts";

const SUPPORTED_PLATFORMS = ["twitter", "facebook", "instagram", "linkedin"] as const;

type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];

const normalizePlatform = (
  value: string | undefined,
): SupportedPlatform | null => {
  if (!value) return null;

  const p = value.trim().toLowerCase();

  switch (p) {
    case "twitter":
    case "x":
      return "twitter";

    case "facebook":
      return "facebook";

    case "instagram":
    case "ig":
      return "instagram";

    case "linkedin":
      return "linkedin";

    default:
      return null;
  }
};

const safeProfileNameForUser = (user: AuthenticatedRequest["user"]) => {
  // Deterministic per-user => avoids “profile with this name already exists”
  return `workspace_${user.userId}`;
};

const extractProfiles = (data: any): any[] => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.profiles)) return data.profiles;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.profile)) return data.profile;
  return [];
};

const extractFirstProfileId = (profile: any): string | null => {
  const pid = profile?._id ?? profile?.id;
  return typeof pid === "string" && pid ? pid : null;
};

const getOrCreateZernioProfile = async (
  user: AuthenticatedRequest["user"] | undefined,
): Promise<string> => {
  if (!user) throw new Error("Missing authenticated user");

  const profileName = safeProfileNameForUser(user);

  // 1) If we already stored a profile id, re-use it
  const existingUser = await User.findById(user.userId).select("zernioProfileId");
  const storedProfileId = existingUser?.zernioProfileId;
  if (storedProfileId && storedProfileId !== "pending") {
    return storedProfileId;
  }

  // 2) Try to find by deterministic name
  const listResult = await zernio.profiles.listProfiles();
  const profiles = extractProfiles(listResult?.data ?? listResult);

  const matched =
    profiles.find((p) => p?.name === profileName || p?.profileName === profileName) ?? null;

  const matchedId = extractFirstProfileId(matched);
  if (matchedId) {
    await User.findByIdAndUpdate(user.userId, { zernioProfileId: matchedId });
    return matchedId;
  }

  // 3) Create deterministically. If Zernio says it already exists, re-list and reuse.
  try {
    const createResult = await zernio.profiles.createProfile({
      body: { name: profileName },
    });

    const created = createResult?.profile ?? createResult?.data ?? createResult;
    const createdId = extractFirstProfileId(created);

    if (!createdId) throw new Error("Failed to create zernio profile - no ID returned");

    await User.findByIdAndUpdate(user.userId, { zernioProfileId: createdId });
    return createdId;
  } catch (error: any) {
    const msg = error?.message || "";
    if (String(msg).toLowerCase().includes("already exists")) {
      const relist = await zernio.profiles.listProfiles();
      const relistedProfiles = extractProfiles(relist?.data ?? relist);
      const relistedMatch =
        relistedProfiles.find((p) => p?.name === profileName || p?.profileName === profileName) ?? null;
      const relistedId = extractFirstProfileId(relistedMatch);
      if (relistedId) {
        await User.findByIdAndUpdate(user.userId, { zernioProfileId: relistedId });
        return relistedId;
      }
    }

    console.error("getOrCreateZernioProfile Error:", error?.message || error);
    throw error;
  }
};

export const generateAuthUrl = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const platform = normalizePlatform(req.params.platform);
    if (!platform) {
      res.status(400).json({
        message: `Unsupported platform. Supported: ${SUPPORTED_PLATFORMS.join(", ")}`,
      });
      return;
    }

    const profileId = await getOrCreateZernioProfile(req.user);

    const frontendUrl = process.env.FRONTEND_URL || req.headers.origin || "http://localhost:5173";
    const redirectUrl = `${frontendUrl}/accounts?sync=true&connected=${platform}`;

    // Zernio docs: GET /v1/connect/{platform}?profileId=&redirect_url=
    // The SDK expects `platform` + `query`.
    const response = await zernio.connect.getConnectUrl({
      path: {
        platform,
      },
      query: {
        profileId,
        redirect_url: redirectUrl,
      },
    } as any);

    const data = response?.data ?? response;
    const authUrl = data?.authUrl ?? data?.url;

    if (!authUrl) {
      throw new Error(`Zernio did not return an OAuth URL. Full response: ${JSON.stringify(data)}`);
    }

    res.json({ url: authUrl });
  } catch (error: any) {
    res.status(500).json({
      message: error?.response?.data?.message || error?.message || "Failed to generate OAuth URL",
    });
  }
};

export const syncAccounts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const profileId = await getOrCreateZernioProfile(req.user);

    const response = await zernio.accounts.listAccounts({
      query: {
        profileId,
      },
    });

    const data = response?.data ?? response;
    const zernioAccounts = data?.accounts ?? (Array.isArray(data) ? data : []);

    const supportedPlatforms = ["twitter", "linkedin", "facebook", "instagram"];
    const syncedAccounts: any[] = [];

    for (const zAccounts of zernioAccounts) {
      const zid = zAccounts?._id ?? zAccounts?.id;
      if (!zid) continue;

      const rawPlatform = String(zAccounts.platform || zAccounts.type || "").toLowerCase();
      const normalizedPlatform = supportedPlatforms.find((p) => rawPlatform.includes(p));
      if (!normalizedPlatform) continue;

      const account = await Account.findOneAndUpdate(
        { zernioAccountId: zid },
        {
          user: req.user.userId,
          platform: normalizedPlatform,
          handle: zAccounts.username || zAccounts.name || zAccounts.handle || "Unknown",
          zernioAccountId: zid,
          status: "connected",
          avatarUrl: zAccounts.avatarUrl || zAccounts.picture || zAccounts.profile_image_url,
        },
        { upsert: true, new: true, returnDocument: "after" as any },
      );

      syncedAccounts.push(account);
    }

    res.json(syncedAccounts);
  } catch (error: any) {
    res.status(500).json({
      message: error?.response?.data?.message || error?.message || "Failed to sync accounts",
    });
  }
};

