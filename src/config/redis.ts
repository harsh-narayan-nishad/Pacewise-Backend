import Redis from "ioredis";
import { env } from "@/config/env";
import { logger } from "@/config/logger";

/**
 * Redis is OPTIONAL. With REDIS_URL set, rate-limit counters and
 * notification pub/sub are shared by every API instance. Without it
 * (single instance, local dev) both run in this process' memory — the
 * callers check `redis === null` and fall back.
 */
export const redis: Redis | null = env.REDIS_URL ? new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 }) : null;
export const redisSub: Redis | null = env.REDIS_URL ? new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 }) : null;

redis?.on("error", (err) => logger.error({ err }, "Redis client error"));
redisSub?.on("error", (err) => logger.error({ err }, "Redis subscriber error"));
