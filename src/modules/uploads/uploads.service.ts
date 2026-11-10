import { randomUUID } from "crypto";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "@/config/s3";
import { env } from "@/config/env";
import { AppError } from "@/utils/AppError";

const UPLOAD_URL_TTL_SECONDS = 5 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 60 * 60;

function client() {
  if (!s3) throw new AppError(503, "File storage is not configured (set the S3_* variables)", "STORAGE_DISABLED");
  return s3;
}

/** Presigned PUT: the client uploads straight to object storage. */
export async function createPresignedUpload(userId: string, filename: string, contentType: string) {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `uploads/${userId}/${randomUUID()}-${safeName}`;
  const url = await getSignedUrl(client(), new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, ContentType: contentType }), {
    expiresIn: UPLOAD_URL_TTL_SECONDS,
  });
  return { uploadUrl: url, key, expiresInSeconds: UPLOAD_URL_TTL_SECONDS };
}

export async function createPresignedDownload(key: string) {
  const url = await getSignedUrl(client(), new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), { expiresIn: DOWNLOAD_URL_TTL_SECONDS });
  return { url, expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS };
}
