import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    mediaUrl: { type: String },
    mediaType: {
      type: String,
      enum: ["image", "video"],
    },
    // Store one or more platforms as an array of strings. This matches the frontend
    // expectation (`post.platforms.map`) and allows scheduling a post to multiple
    // platforms in the future.
    platforms: {
      type: [String],
      enum: [
        "twitter",
        "facebook",
        "instagram",
        "linkedin",
        "facebook_page",
        "linkedin_page",
        "instagram_business",
      ],
    },
    scheduledFor: { type: Date, required: true },
    zernioPostId: { type: String },
    failureReason: { type: String },
    status: {
      type: String,
      enum: ["draft", "scheduled", "published", "failed"],
      default: "scheduled",
    },
  },
  { timestamps: true },
);

export const Post = mongoose.model("Post", postSchema);
