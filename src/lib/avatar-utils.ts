import { ValidationError } from "@/lib/errors";

export function detectContentType(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return "image/gif";
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function sanitizeFileName(name: string): string {
  const sanitized = name
    .replace(/\0/g, "")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\.{2,}/g, ".")
    .slice(0, 255);
  return sanitized || "avatar";
}

export async function processImage(
  buffer: Buffer,
  contentType: string,
): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  try {
    // GIFはアニメーション保持のためリサイズをスキップし、メタデータ除去のみ行う
    if (contentType === "image/gif") {
      return await sharp(buffer, { animated: true }).gif().toBuffer();
    }
    // rotate() で EXIF の回転情報を適用し、512x512にリサイズしてメタデータを除去
    const image = sharp(buffer)
      .rotate()
      .resize(512, 512, { fit: "cover", withoutEnlargement: true });
    switch (contentType) {
      case "image/jpeg":
        return await image.jpeg().toBuffer();
      case "image/png":
        return await image.png().toBuffer();
      case "image/webp":
        return await image.webp().toBuffer();
      default:
        return buffer;
    }
  } catch {
    throw new ValidationError("画像の処理に失敗しました");
  }
}
