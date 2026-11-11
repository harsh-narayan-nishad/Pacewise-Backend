import pino from "pino";

/** Pretty printing is a dev-only nicety (pino-pretty is a dev dependency). If it is not installed, as on a production server, fall back to plain JSON instead of crashing. */
function canPrettyPrint(): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  try {
    require.resolve("pino-pretty");
    return true;
  } catch {
    return false;
  }
}

/**
 * Structured JSON logging (not console.log) on purpose: once this API runs
 * as multiple replicas behind a load balancer, there's no single terminal
 * to tail — logs get shipped somewhere (CloudWatch, Loki, Datadog, etc.)
 * and need to be machine-parseable to be useful across instances.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport: canPrettyPrint() ? { target: "pino-pretty", options: { colorize: true } } : undefined,
});
