import crypto from "node:crypto";
import * as Minio from "minio";

const isS3 = process.env.STORAGE_PROVIDER === "s3";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required when STORAGE_PROVIDER=s3`);
  }
  return value;
}

const minioClient = new Minio.Client({
  endPoint: isS3
    ? "s3.amazonaws.com"
    : process.env.MINIO_ENDPOINT || "localhost",
  port: isS3 ? 443 : Number(process.env.MINIO_PORT) || 9000,
  useSSL: isS3,
  accessKey: isS3
    ? requireEnv("MINIO_ACCESS_KEY")
    : process.env.MINIO_ACCESS_KEY || "minioadmin",
  secretKey: isS3
    ? requireEnv("MINIO_SECRET_KEY")
    : process.env.MINIO_SECRET_KEY || "minioadmin",
  ...(isS3 && { region: process.env.AWS_REGION || "ap-northeast-1" }),
});

const BUCKET_NAME =
  process.env.MINIO_BUCKET_NAME || "agent-interview-documents";

export async function ensureBucket() {
  if (isS3) return;
  const exists = await minioClient.bucketExists(BUCKET_NAME);
  if (!exists) {
    await minioClient.makeBucket(BUCKET_NAME);
  }
}

export async function uploadFile(
  fileName: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  await ensureBucket();
  const lastSlash = fileName.lastIndexOf("/");
  const dir = lastSlash === -1 ? "" : fileName.slice(0, lastSlash + 1);
  const base = lastSlash === -1 ? fileName : fileName.slice(lastSlash + 1);
  const objectName = `${dir}${crypto.randomUUID()}-${base}`;
  await minioClient.putObject(BUCKET_NAME, objectName, buffer, buffer.length, {
    "Content-Type": contentType,
  });
  return objectName;
}

const URL_CACHE_TTL = 30 * 60 * 1000; // 30分
const URL_CACHE_MAX_SIZE = 1000;
const urlCache = new Map<
  string,
  { url: string; expiresAt: number; lastAccessedAt: number }
>();

function evictExpiredUrlCache(): void {
  const now = Date.now();
  for (const [key, entry] of urlCache) {
    if (entry.expiresAt <= now) {
      urlCache.delete(key);
    }
  }
}

export async function getFileUrl(objectName: string): Promise<string> {
  const cached = urlCache.get(objectName);
  if (cached && cached.expiresAt > Date.now()) {
    cached.lastAccessedAt = Date.now();
    return cached.url;
  }
  const url = await minioClient.presignedGetObject(
    BUCKET_NAME,
    objectName,
    60 * 60,
  );
  if (urlCache.size >= URL_CACHE_MAX_SIZE) {
    evictExpiredUrlCache();
    // 期限切れエントリ削除後もまだ上限超ならLRUエントリを削除
    if (urlCache.size >= URL_CACHE_MAX_SIZE) {
      let lruKey: string | undefined;
      let lruTime = Infinity;
      for (const [key, entry] of urlCache) {
        if (entry.lastAccessedAt < lruTime) {
          lruTime = entry.lastAccessedAt;
          lruKey = key;
        }
      }
      if (lruKey) urlCache.delete(lruKey);
    }
  }
  const now = Date.now();
  urlCache.set(objectName, {
    url,
    expiresAt: now + URL_CACHE_TTL,
    lastAccessedAt: now,
  });
  return url;
}

export function invalidateUrlCache(objectName: string): void {
  urlCache.delete(objectName);
}

export async function deleteFile(objectName: string): Promise<void> {
  await minioClient.removeObject(BUCKET_NAME, objectName);
}

export async function getFileBuffer(objectName: string): Promise<Buffer> {
  const stream = await minioClient.getObject(BUCKET_NAME, objectName);
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

export { minioClient, BUCKET_NAME };
