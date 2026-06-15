import { Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import config from "../config/config.ts";
import { GoogleGenAI } from "@google/genai";
import { Generation } from "../models/generation.model.ts";
import { Post } from "../models/post.model.ts";
import { ActivityLog } from "../models/activitylog.model.ts";
import { Account } from "../models/account.model.ts";
import zernio from "../config/zernio.config.ts";

export const generatePost = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { prompt, tone, generateImage } = req.body as {
      prompt: string;
      tone?: string;
      generateImage?: boolean;
    };

    const userId = (req as any)?.user?.userId as string | undefined;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const apiKey = config.geminiApiKey;
    if (!apiKey) {
      res.status(400).json({ message: "Gemini API key is missing" });
      return;
    }

    if (!prompt || typeof prompt !== "string") {
      res.status(400).json({ message: "Missing or invalid prompt" });
      return;
    }

    const ai = new GoogleGenAI({ apiKey });

    const textResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Generate a social media post based on this prompt: ${prompt}\n\nTone: ${
                tone ?? ""
              }\nInclude relevent hashtags.\nFormat the response as JSON with "content" and "imagePrompt" fields.\nThe "imagePrompt" should be a highly descriptive prompt for an image generator that complements the post.`,
            },
          ],
        },
      ],
    });

    let content = "";
    let imagePrompt = prompt;

    try {
      const rawText = textResponse.text || "";
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const data = jsonMatch
        ? JSON.parse(jsonMatch[0])
        : { content: rawText, imagePrompt: prompt };

      content = data?.content ?? rawText ?? "";
      imagePrompt = data?.imagePrompt ?? prompt;
    } catch {
      content = textResponse.text || "";
      imagePrompt = prompt;
    }

    let mediaUrl = "";

    if (generateImage) {
      try {
        const imageResponse = await ai.models.generateContent({
          model: "gemini-3.1-flash-image",
          contents: imagePrompt,
        });

        const parts = imageResponse?.candidates?.[0]?.content?.parts ?? [];
        const inlineData = parts.find((p: any) => p?.inlineData)?.inlineData;

        if (!inlineData?.data) {
          throw new Error("Image generation returned no inlineData");
        }

        const base64 = inlineData.data;
        const buffer = Buffer.from(base64, "base64");

        const outputDir = path.join(process.cwd(), "public", "generated");
        fs.mkdirSync(outputDir, { recursive: true });

        const filename = `gemini-${Date.now()}.png`;
        const filePath = path.join(outputDir, filename);

        fs.writeFileSync(filePath, buffer);

        mediaUrl = `/generated/${filename}`;
      } catch (error: any) {
        mediaUrl = "";
        console.error("generateImage failed:", error?.message || error);
      }
    }

    // Persist the generation record for the authenticated user.
    try {
      await Generation.create({
        user: userId,
        prompt,
        content,
        mediaUrl: mediaUrl || undefined,
        mediaType: mediaUrl ? "image" : undefined,
        tone,
      });

      // Create activity entry for dashboard.
      // Use `content`/generated text as the description to show on the activity feed.
      await ActivityLog.create({
        user: userId,
        actionType: "AI_REPLY",
        description:
          (content || "")
            .trim()
            .slice(0, 140) + ((content || "").trim().length > 140 ? "..." : ""),
        aiGeneratedText: content || undefined,
        relatedPost: undefined,
        platform: undefined,
      });
    } catch (saveErr) {
      // Log but do not fail the request – generation itself succeeded.
      console.error("Failed to save generation/activity:", saveErr);
    }

    res.status(200).json({ prompt, content, imagePrompt, mediaUrl });
  } catch (error: any) {
    res.status(500).json({
      message: error?.message || "Internal Server Error",
    });
  }
};

export const getGenerations = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as any)?.user?.userId as string | undefined;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const generations = await Generation.find({ user: userId }).sort({
      createdAt: -1,
    });

    res.json(generations);
  } catch (err: any) {
    // Log the error for server logs and return a more descriptive message to aid debugging.
    console.error("schedulePost error:", err);
    res.status(500).json({ message: err?.message || "Internal Server Error" });
  }
};

export const getPosts = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any)?.user?.userId as string | undefined;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const posts = await Post.find({ user: userId }).sort({ createdAt: -1 });

    // Ensure the `platforms` field is always an array for the frontend.
    const normalized = posts.map((p: any) => {
      const platforms = p.platforms;
      if (Array.isArray(platforms)) return p;
      // If stored as a string (legacy data), wrap it in an array.
      return { ...p.toObject(), platforms: platforms ? [platforms] : [] };
    });

    res.json(normalized);
  } catch {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const schedulePost = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as any)?.user?.userId as string | undefined;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { content, platforms, scheduledFor, status, mediaUrl, mediaType } =
      req.body as {
        content?: string;
        platforms?: string | string[];
        scheduledFor?: string | Date;
        status?: "draft" | "scheduled" | "published" | "failed";
        // media is optional
        mediaUrl?: string;
        mediaType?: "image" | "video";
      };

    if (!content || typeof content !== "string") {
      res.status(400).json({ message: "Missing content" });
      return;
    }
    if (!scheduledFor) {
      res.status(400).json({ message: "Missing scheduledFor" });
      return;
    }

    const scheduledAt =
      scheduledFor instanceof Date ? scheduledFor : new Date(scheduledFor);

    if (Number.isNaN(scheduledAt.getTime())) {
      res.status(400).json({ message: "Invalid scheduledFor" });
      return;
    }

    const allowedPlatforms = [
      "twitter",
      "facebook",
      "instagram",
      "linkedin",
      "facebook_page",
      "linkedin_page",
      "instagram_business",
    ];

    const allowedStatuses = ["draft", "scheduled", "published", "failed"];

    // Ensure platforms is an array of strings for storage.
    let platformArray: string[] = [];
    if (Array.isArray(platforms)) {
      platformArray = platforms;
    } else if (typeof platforms === "string") {
      try {
        const parsed = JSON.parse(platforms);
        platformArray = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        platformArray = [platforms];
      }
    }

    if (
      platformArray.length === 0 ||
      platformArray.some((p) => typeof p !== "string")
    ) {
      res.status(400).json({ message: "Missing or invalid platforms" });
      return;
    }

    if (platformArray.some((p) => !allowedPlatforms.includes(p))) {
      res.status(400).json({ message: "Unsupported platform" });
      return;
    }

    const statusValue =
      status && allowedStatuses.includes(status) ? status : "scheduled";

    // Find connected Zernio accounts for selected platforms
    const accounts = await Account.find({
      user: userId,
      platform: { $in: platformArray as any },
      status: "connected",
      zernioAccountId: { $exists: true, $ne: null },
    });

    if (!accounts.length) {
      res.status(400).json({ message: "No connected Zernio accounts found" });
      return;
    }

    const zernioPlatforms = accounts.map((acc) => ({
      platform: acc.platform,
      accountId: acc.zernioAccountId,
    }));

    // Zernio mediaItems is optional: only include when mediaUrl is provided
    const hasMedia = typeof mediaUrl === "string" && mediaUrl.trim().length > 0;

    const payload: any = {
      content,
      scheduledFor: scheduledAt.toISOString(),
      platforms: zernioPlatforms,
    };

    if (hasMedia) {
      payload.mediaItems = [
        {
          type: mediaType || "image",
          url: mediaUrl,
        },
      ];
    }

    // Create/schedule through Zernio
    const response = await zernio.posts.createPost({
      body: payload,
    });

    const zernioPostId =
      response?.data?.post?._id || response?.data?.post?.id || undefined;

    const post = await Post.create({
      user: userId,
      content,
      mediaUrl: hasMedia ? mediaUrl : undefined,
      mediaType: hasMedia ? mediaType : undefined,
      platforms: platformArray as any,
      scheduledFor: scheduledAt,
      status: statusValue as any,
      zernioPostId,
      failureReason: undefined,
    });

    res.status(201).json(post);
  } catch {
    res.status(500).json({ message: "Internal Server Error" });
  }
};
