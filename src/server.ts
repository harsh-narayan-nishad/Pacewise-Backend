import { createApp } from "@/app";
import { env } from "@/config/env";
import { logger } from "@/config/logger";
import { connectDb, disconnectDb } from "@/config/db";
import { redis, redisSub } from "@/config/redis";
import { subscribeToEvents } from "@/modules/notifications/notifications.service";
import { localEventBus } from "@/utils/eventBus";
import { checkMailSetup } from "@/utils/mailer";

async function main() {
  await connectDb();
  void checkMailSetup();

  // The last hop in the real-time pipeline: a notification published on
  // ANY instance reaches this instance via Redis pub/sub, and is handed to
  // this process's own localEventBus, which the SSE stream handler
  // (notifications.controller.ts) listens on to push to whichever
  // connections THIS instance happens to be holding open. Every instance
  // runs this same line, so it doesn't matter which instance created the
  // event or which instance a given client is connected to.
  subscribeToEvents((notification) => {
    localEventBus.emit("notification", notification);
  });

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, "speed-reader-backend listening");
  });

  // Graceful shutdown: stop accepting new connections, let in-flight
  // requests finish, then close the DB/Redis connections cleanly. Matters
  // for a distributed deployment where instances are routinely
  // started/stopped by the orchestrator (deploys, autoscaling) — an
  // instance that just dies mid-request corrupts nothing here (every
  // write is a single DB statement), but a clean shutdown avoids dropped
  // responses and log noise.
  async function shutdown(signal: string) {
    logger.info({ signal }, "shutting down");
    server.close(async () => {
      await disconnectDb();
      redis?.disconnect();
      redisSub?.disconnect();
      process.exit(0);
    });
    // Force-exit if close() hangs (e.g. a stuck keep-alive connection).
    setTimeout(() => process.exit(1), 10_000).unref();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error({ err }, "fatal startup error");
  process.exit(1);
});
