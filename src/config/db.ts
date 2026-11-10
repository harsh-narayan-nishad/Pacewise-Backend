import mongoose from "mongoose";
import { env } from "@/config/env";
import { logger } from "@/config/logger";

/** One Mongoose connection per process, reused by every request. MongoDB
 *  is the single durable source of truth shared by every API instance. */
export async function connectDb(): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 15_000 });
  logger.info({ db: mongoose.connection.name }, "MongoDB connected");
  // Create indexes (unique constraints etc.) declared on the models.
  await mongoose.syncIndexes();
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
