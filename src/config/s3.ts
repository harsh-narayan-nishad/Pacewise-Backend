import { S3Client } from "@aws-sdk/client-s3";
import { env } from "@/config/env";

/** Null when S3_* is not configured — uploads then answer 503. */
export const s3: S3Client | null = env.s3Enabled
  ? new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: env.s3PathStyle,
      credentials: { accessKeyId: env.S3_ACCESS_KEY_ID as string, secretAccessKey: env.S3_SECRET_ACCESS_KEY as string },
    })
  : null;
