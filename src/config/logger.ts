import pino from "pino";

/**
 * Structured JSON logging (not console.log) on purpose: once this API runs
 * as multiple replicas behind a load balancer, there's no single terminal
 * to tail — logs get shipped somewhere (CloudWatch, Loki, Datadog, etc.)
 * and need to be machine-parseable to be useful across instances.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport: process.env.NODE_ENV === "development" ? { target: "pino-pretty", options: { colorize: true } } : undefined,
});
