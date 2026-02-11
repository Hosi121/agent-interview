// マジックバイトによるファイル形式検証
const MAGIC_BYTES: { offset: number; bytes: number[] }[] = [
  { offset: 0, bytes: [0xff, 0xd8, 0xff] }, // JPEG
  { offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47] }, // PNG
  { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF
];

export function validateMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;

  // WebP: RIFFヘッダー(0-3) + "WEBP"シグネチャ(8-11)
  const isWebP =
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;

  return (
    isWebP ||
    MAGIC_BYTES.some(({ offset, bytes }) =>
      bytes.every((byte, i) => buffer[offset + i] === byte),
    )
  );
}

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
  return name
    .replace(/\0/g, "")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\.{2,}/g, ".")
    .slice(0, 255);
}
