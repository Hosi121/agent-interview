import * as Minio from "minio";

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || "localhost",
  port: Number(process.env.MINIO_PORT) || 9000,
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
  secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
});

const BUCKET_NAME = process.env.MINIO_BUCKET_NAME || "agent-interview-documents";

export async function ensureBucket() {
  const exists = await minioClient.bucketExists(BUCKET_NAME);
  if (!exists) {
    await minioClient.makeBucket(BUCKET_NAME);
  }
}

export async function uploadFile(
  fileName: string,
  buffer: Buffer,
  contentType: string
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
