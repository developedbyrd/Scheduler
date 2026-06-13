import cron from "node-cron";
import { Post } from "../models/post.model.ts";
import { Account } from "../models/account.model.ts";
import zernio from "../config/zernio.config.ts";
import { ActivityLog } from "../models/activitylog.model.ts";

export const initScheduler = () => {
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      const postToPublish = await Post.find({
        status: "scheduled",
        scheduledFor: { $lte: now },
      });

      for (const post of postToPublish) {
        try {
          // Post.platforms is a single enum string in your schema.
          // If you ever change it to array, adjust this query accordingly.
          const account = await Account.find({
            user: post.user,
            platform: post.platforms,
            status: "connected",
            zernioAccountId: { $exists: true },
          });

          if (account.length === 0) {
            console.log(
              `No connected zernio accounts found for post ${post._id}`,
            );
            continue;
          }

          const zernioPlatforms = account.map((acc) => ({
            tform: acc.platform,
            accountId: acc.zernioAccountId!,
          }));

          const payload: Record<string, any> = {
            content: post.content,
            publishNow: true,
            platforms: zernioPlatforms,
          };

          // media in payload (backend creates mediaUrl when generateImage=true)
          if (post.mediaUrl) {
            payload.media = {
              type: post.mediaType ?? "image",
              url: post.mediaUrl,
            };
          }

          const response = await zernio.posts.createPost({
            body: payload,
          });

          const publishedPost = response.data?.post;
          if (!publishedPost) {
            throw new Error("Failed to get post object from zernio response");
          }

          post.status = "published";
          await post.save();

          await ActivityLog.create({
            user: post.user,
            actionType: "POST_PUBLISHED",
            description: `Published post to ${account
              .map((a) => a.platform)
              .join(", ")}`,
            relatedPost: post._id,
          });
        } catch (error: any) {
          const errData =
            error?.response?.data ?? error?.data ?? error?.message ?? error;
          console.error(`Failed to publish post ${post._id} :`, errData);
          post.status = "failed";
          await post.save();
        }
      }

      if (postToPublish.length > 0) {
        console.log(
          `Evaluated ${postToPublish.length} posts at ${now.toISOString()}`,
        );
      }
    } catch (error) {
      console.error("Error in scheduler: ", error);
    }
  });

  console.log("Scheduler service initialized");
};
