import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { env } from "@/config/env";
import { logger } from "@/config/logger";
import { apiRouter } from "@/routes";
import { errorHandler, notFoundHandler } from "@/middleware/errorHandler";

export function createApp(): Express {
  const app = express();

  // Stateless middleware only — nothing here keeps per-request state in
  // process memory, which is what lets any instance behind a load balancer
  // handle any request (see README's distributed-design notes).
  app.use(helmet());
  app.use(
    cors({
      // Empty allowlist in CORS_ORIGINS means "allow any origin" — useful
      // for native mobile clients, which don't send an Origin header the
      // browser CORS model governs anyway. Set CORS_ORIGINS to lock this
      // down for a browser-facing deployment.
      origin: env.corsOrigins.length > 0 ? env.corsOrigins : true,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(pinoHttp({ logger }));

  // Unauthenticated, dependency-free liveness check for a load balancer or
  // orchestrator (Kubernetes, ECS, ...) to poll — deliberately does not
  // touch Postgres/Redis, so a slow dependency doesn't flip a healthy
  // instance to "down" and get it killed.
  app.get("/health", (_req, res) => res.json({ status: "ok", uptime: process.uptime() }));

  app.use("/api/v1", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
