import cron from "node-cron";
import config from "../config/config.ts";

export const initKeepAlive = () => {
  cron.schedule("*/15 * * * *", async () => {
    try {
      if (!config.renderUrl) {
        console.warn(
          "Keep-alive service: RENDER_URL is not set in environment; skipping ping.",
        );
        return;
      }
      const response = await fetch(config.renderUrl, { method: "GET" });
      console.log(
        `Keep-alive ping to ${config.renderUrl} responded with status ${response.status}`,
      );
    } catch (error) {
      console.error("Keep-alive ping failed:", error);
    }
  });

  console.log("Keep-alive service initialized (ping every 15 minutes)");
};
