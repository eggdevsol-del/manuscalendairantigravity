/**
 * r2.ts — Cloudflare R2 client (S3-compatible)
 * ─────────────────────────────────────────────
 * Provides presigned upload URLs so clients upload
 * directly to R2, bypassing the server for file bytes.
 */
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

// ── R2 configuration from environment ────────────────────
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const BUCKET_NAME = process.env.R2_BUCKET_NAME!;
const PUBLIC_URL = process.env.R2_PUBLIC_URL!; // e.g. https://pub-xxx.r2.dev

// ── S3 client configured for R2 ─────────────────────────
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

// ── Helpers ──────────────────────────────────────────────

/**
 * Generate a unique object key with optional folder prefix.
 * e.g. "avatars/550e8400-e29b-41d4-a716-446655440000.jpg"
 */
export function generateObjectKey(
  folder: string,
  originalFilename: string
): string {
  const ext = originalFilename.split(".").pop()?.toLowerCase() || "jpg";
  const id = randomUUID();
  return `${folder}/${id}.${ext}`;
}

/**
 * Get a presigned PUT URL for direct client-to-R2 upload.
 * The client uploads the file directly to this URL via HTTP PUT.
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 600 // 10 minutes
): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn });
  const publicUrl = `${PUBLIC_URL.replace(/\/$/, "")}/${key}`;

  return { uploadUrl, publicUrl, key };
}

/**
 * Delete an object from R2.
 */
export async function deleteObject(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  await r2Client.send(command);
}

/**
 * Construct the public URL for an existing key.
 */
export function getPublicUrl(key: string): string {
  return `${PUBLIC_URL.replace(/\/$/, "")}/${key}`;
}

export { r2Client, BUCKET_NAME };
