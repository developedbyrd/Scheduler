import { Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import config from "../config/config.ts";
import { GoogleGenAI } from "@google/genai";
import { Generation } from "../models/generation.model.ts";
import { Post } from "../models/post.model.ts";

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

        const parts =
          imageResponse?.candidates?.[0]?.content?.parts ?? [];
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

    res.status(200).json({ content, imagePrompt, mediaUrl });
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
  } catch {
    res.status(500).json({ message: "Internal Server Error" });
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

    res.json(posts);
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

    const { content, platforms, scheduledFor, status } = req.body as {
      content?: string;
      platforms?: string | string[];
      scheduledFor?: string | Date;
      status?: "draft" | "scheduled" | "published" | "failed";
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
      scheduledFor instanceof Date
        ? scheduledFor
        : new Date(scheduledFor);

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

    const platformRaw = Array.isArray(platforms) ? platforms[0] : platforms;
    if (!platformRaw || typeof platformRaw !== "string") {
      res.status(400).json({ message: "Missing or invalid platforms" });
      return;
    }
    if (!allowedPlatforms.includes(platformRaw)) {
      res.status(400).json({ message: "Unsupported platform" });
      return;
    }

    const statusValue =
      status && allowedStatuses.includes(status) ? status : "scheduled";

    const post = await Post.create({
      user: userId,
      content,
      mediaUrl: undefined,
      mediaType: undefined,
      platforms: platformRaw as any,
      scheduledFor: scheduledAt,
      status: statusValue as any,
    });

    res.status(201).json(post);
  } catch {
    res.status(500).json({ message: "Internal Server Error" });
  }
};
