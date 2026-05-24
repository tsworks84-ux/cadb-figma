import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Readable } from "stream";
import { createWriteStream, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { pipeline } from "stream/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCAL_UPLOADS = join(__dirname, "../../uploads");

const REGION = process.env.AWS_REGION ?? "ap-south-1";
export const BUCKET = process.env.AWS_S3_BUCKET ?? "";

export const s3 = new S3Client({ region: REGION });

/**
 * Upload a file. If AWS_S3_BUCKET is set → S3. Otherwise → local disk (dev fallback).
 * Returns a public URL.
 */
export async function uploadFile(
  data: Buffer | Readable,
  key: string,         // e.g. "uploads/photo_xyz.jpg"
  contentType: string,
  localSubPath: string // e.g. "photo_xyz.jpg" (relative to uploads/)
): Promise<string> {
  if (BUCKET) {
    const stream = Buffer.isBuffer(data) ? Readable.from(data) : data;
    const upload = new Upload({
      client: s3,
      params: { Bucket: BUCKET, Key: key, Body: stream, ContentType: contentType },
    });
    await upload.done();
    return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
  }

  // Local fallback for dev
  const dir = join(LOCAL_UPLOADS, localSubPath.split("/").slice(0, -1).join("/"));
  mkdirSync(dir, { recursive: true });
  const filePath = join(LOCAL_UPLOADS, localSubPath);
  const src = Buffer.isBuffer(data) ? Readable.from(data) : data;
  await pipeline(src, createWriteStream(filePath));
  return `/uploads/${localSubPath}`;
}

export async function deleteFile(urlOrKey: string): Promise<void> {
  if (!BUCKET) return;
  try {
    const key = new URL(urlOrKey).pathname.replace(/^\//, "");
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch { /* ignore */ }
}
