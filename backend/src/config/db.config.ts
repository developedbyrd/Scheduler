import mongoose from "mongoose";
import config from "./config.ts";

export const ConnectDB = async () => {
  try {
    mongoose.connection.on("connected", async () => {
      console.log("DB Connected");
    });
    await mongoose.connect(config.mongoDbURI as string);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};
