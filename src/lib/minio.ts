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
  accessKey: isS3 ? requireEnv("MINIO_ACCESS_KEY") : process.env.MINIO_ACCESS_KEY || "minioadmin",
  secretKey: isS3 ? requireEnv("MINIO_SECRET_KEY") : process.env.MINIO_SECRET_KEY || "minioadmin",
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
  const objectName = `${Date.now()}-${fileName}`;
  await minioClient.putObject(BUCKET_NAME, objectName, buffer, buffer.length, {
    "Content-Type": contentType,
  });
  return objectName;
}

export async function getFileUrl(objectName: string): Promise<string> {
  return await minioClient.presignedGetObject(BUCKET_NAME, objectName, 60 * 60);
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
