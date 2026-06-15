

import cron from "node-cron";
import { Post } from "../models/post.model.ts";
import { Account } from "../models/account.model.ts";
import zernio from "../config/zernio.config.ts";
import { ActivityLog } from "../models/activitylog.model.ts";

export const initScheduler = () => {
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();

      const postsToPublish: any[] = await Post.find({
        status: "scheduled",
        scheduledFor: { $lte: now },
        zernioPostId: { $exists: false },
      });

      for (const post of postsToPublish) {
        try {
          const accounts = await Account.find({
            user: post.user,
            platform: {
              $in: Array.isArray(post.platforms)
                ? post.platforms
                : [post.platforms],
            },
            status: "connected",
            zernioAccountId: { $exists: true, $ne: null },
          });

          if (!accounts.length) {
            throw new Error(`No connected accounts found for post ${post._id}`);
          }

          const platforms = accounts.map((acc) => ({
            platform: acc.platform, // FIXED
            accountId: acc.zernioAccountId,
          }));

          const payload: any = {
            content: post.content,
            publishNow: true,
            platforms,
          };

          if (post.mediaUrl) {
            payload.mediaItems = [
              {
                type: post.mediaType || "image",
                url: post.mediaUrl,
              },
            ];
          }

          await zernio.posts.createPost({
            body: payload,
          });

          post.status = "published";
          await post.save();

          await ActivityLog.create({
            user: post.user,
            actionType: "POST_PUBLISHED",
            description: `Published post to ${accounts
              .map((a: any) => a.platform)
              .join(", ")}`,
            relatedPost: post._id,
          });
        } catch (error: any) {
          post.status = "failed";

          (post as any).failureReason =
            JSON.stringify(error?.response?.data) ||
            error?.message ||
            "Unknown error";

          await post.save();
        }
      }
    } catch (error) {
      console.error("Scheduler error:", error);
    }
  });

  console.log("Scheduler service initialized");
};
