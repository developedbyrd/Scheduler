// import cron from "node-cron";
// import { Post } from "../models/post.model.ts";
// import { Account } from "../models/account.model.ts";
// import zernio from "../config/zernio.config.ts";
// import { ActivityLog } from "../models/activitylog.model.ts";

// export const initScheduler = () => {
//   cron.schedule("* * * * *", async () => {
//     try {
//       const now = new Date();
//       const postToPublish = await Post.find({
//         status: "scheduled",
//         scheduledFor: { $lte: now },
//       });

//       for (const post of postToPublish) {
//         try {
//           // `post.platforms` is now stored as an array of strings. Find all connected
//           // Zernio accounts whose platform is included in that array.
//           const account = await Account.find({
//             user: post.user,
//             platform: { $in: Array.isArray(post.platforms) ? post.platforms : [post.platforms] },
//             status: "connected",
//             zernioAccountId: { $exists: true },
//           });

//           if (account.length === 0) {
//             console.log(
//               `No connected zernio accounts found for post ${post._id}`,
//             );
//             continue;
//           }

//           const zernioPlatforms = account.map((acc) => ({
//             tform: acc.platform,
//             accountId: acc.zernioAccountId!,
//           }));

//           const payload: Record<string, any> = {
//             content: post.content,
//             publishNow: true,
//             platforms: zernioPlatforms,
//           };

//           // media in payload (backend creates mediaUrl when generateImage=true)
//           if (post.mediaUrl) {
//             payload.media = {
//               type: post.mediaType ?? "image",
//               url: post.mediaUrl,
//             };
//           }

//           const response = await zernio.posts.createPost({
//             body: payload,
//           });

//           const publishedPost = response.data?.post;
//           if (!publishedPost) {
//             throw new Error("Failed to get post object from zernio response");
//           }

//           post.status = "published";
//           await post.save();

//           await ActivityLog.create({
//             user: post.user,
//             actionType: "POST_PUBLISHED",
//             description: `Published post to ${account
//               .map((a) => a.platform)
//               .join(", ")}`,
//             relatedPost: post._id,
//           });
//         } catch (error: any) {
//           const errData =
//             error?.response?.data ?? error?.data ?? error?.message ?? error;
//           console.error(`Failed to publish post ${post._id} :`, errData);
//           post.status = "failed";
//           await post.save();
//         }
//       }

//       if (postToPublish.length > 0) {
//         console.log(
//           `Evaluated ${postToPublish.length} posts at ${now.toISOString()}`,
//         );
//       }
//     } catch (error) {
//       console.error("Error in scheduler: ", error);
//     }
//   });

//   console.log("Scheduler service initialized");
// };

import cron from "node-cron";
import { Post } from "../models/post.model.ts";
import { Account } from "../models/account.model.ts";
import zernio from "../config/zernio.config.ts";
import { ActivityLog } from "../models/activitylog.model.ts";

export const initScheduler = () => {
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();

      const postsToPublish = await Post.find({
        status: "scheduled",
        scheduledFor: { $lte: now },
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
              .map((a) => a.platform)
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
