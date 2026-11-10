import "dotenv/config";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

/**
 * Every environment variable this API needs, validated once at boot.
 * Failing fast here — a crash with a clear message on `npm start` — beats
 * failing silently later (e.g. a service running for days with a missing
 * JWT secret, signing tokens with "undefined"). This is also what makes
 * it safe to run many instances of this process (see README's "distributed
 * design" section): every instance validates the same way, so there's no
 * instance that's quietly misconfigured differently from the others.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),

  // The ONLY thing you must provide to store data: your MongoDB connection
  // string (Atlas "mongodb+srv://..." or a local "mongodb://...").
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required (your MongoDB connection string)"),
  // Optional. Without it, rate limiting and live notifications run in
  // this process' memory (fine for ONE instance). Set it to run several.
  REDIS_URL: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),

  CORS_ORIGINS: z.string().default(""),

  // Optional. File uploads (/uploads) are disabled until all S3_* are set.
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("true"),

  // E-mail (verification + password reset). Optional: without SMTP_* the e-mails are printed in this
  // server's log instead of sent, so you can still click the links while developing.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default("Pacewise <no-reply@pacewise.local>"),
  // Where the web app lives; e-mailed links point here (/verify-email?token=, /reset-password?token=).
  APP_URL: z.string().url().default("http://localhost:3000"),
  // "true": people must confirm their e-mail before they can sign in. Turn on once SMTP works.
  REQUIRE_EMAIL_VERIFICATION: z.enum(["true", "false"]).default("false"),
  // "true": a new account cannot sign in until an admin approves it (admin app > Approvals).
  REQUIRE_ADMIN_APPROVAL: z.enum(["true", "false"]).default("true"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment configuration:\n" + parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n"));
  if (!existsSync(resolve(process.cwd(), ".env"))) {
    // The most common cause: values were typed into .env.example, which the server never reads.
    // eslint-disable-next-line no-console
    console.error(
      "\nThere is no .env file in " + process.cwd() + ".\n" +
        "The server reads ONLY a file named .env (not .env.example). Create it from the template and fill it in:\n" +
        "    cp .env.example .env\n" +
        "then put your MongoDB URL in MONGODB_URI and two long random secrets in JWT_ACCESS_SECRET / JWT_REFRESH_SECRET."
    );
  }
  process.exit(1);
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean),
  s3Enabled: Boolean(parsed.data.S3_ENDPOINT && parsed.data.S3_BUCKET && parsed.data.S3_ACCESS_KEY_ID && parsed.data.S3_SECRET_ACCESS_KEY),
  smtpEnabled: Boolean(parsed.data.SMTP_HOST && parsed.data.SMTP_USER && parsed.data.SMTP_PASS),
  s3PathStyle: parsed.data.S3_FORCE_PATH_STYLE === "true",
  requireEmailVerification: parsed.data.REQUIRE_EMAIL_VERIFICATION === "true",
  requireAdminApproval: parsed.data.REQUIRE_ADMIN_APPROVAL === "true",
  isProduction: parsed.data.NODE_ENV === "production",
};
