import { NextResponse } from "next/server";
import { withUserAuth } from "@/lib/api-utils";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { deleteFile, getFileUrl, uploadFile } from "@/lib/minio";
import { prisma } from "@/lib/prisma";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

// マジックバイトによるファイル形式検証
const MAGIC_BYTES: [string, number[]][] = [
  ["image/jpeg", [0xff, 0xd8, 0xff]],
  ["image/png", [0x89, 0x50, 0x4e, 0x47]],
  ["image/gif", [0x47, 0x49, 0x46, 0x38]],
  ["image/webp", [0x52, 0x49, 0x46, 0x46]], // RIFF header
];

function validateMagicBytes(buffer: Buffer): boolean {
  return MAGIC_BYTES.some(([, bytes]) =>
    bytes.every((byte, i) => buffer[i] === byte),
  );
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\.{2,}/g, ".")
    .slice(0, 255);
}

export const POST = withUserAuth(async (req, session) => {
  const formData = await req.formData();
  const file = formData.get("file") as File;

  if (!file) {
    throw new ValidationError("ファイルが指定されていません");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new ValidationError("ファイルサイズは5MB以下にしてください");
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new ValidationError(
      "対応していないファイル形式です。JPEG、PNG、WebP、GIF のみ対応しています",
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (!validateMagicBytes(buffer)) {
    throw new ValidationError("ファイルの内容が画像形式と一致しません");
  }

  // 既存アバターがあれば削除（失敗しても継続）
  const user = await prisma.user.findUnique({
    where: { id: session.user.userId },
    select: { avatarPath: true },
  });

  if (user?.avatarPath) {
    try {
      await deleteFile(user.avatarPath);
    } catch (e) {
      console.error("Failed to delete old avatar:", e);
    }
  }

  const sanitizedFileName = sanitizeFileName(file.name);
  const avatarPath = await uploadFile(
    `avatars/${session.user.userId}/${sanitizedFileName}`,
    buffer,
    file.type,
  );

  await prisma.user.update({
    where: { id: session.user.userId },
    data: { avatarPath },
  });

  const avatarUrl = await getFileUrl(avatarPath);

  return NextResponse.json({ avatarUrl }, { status: 201 });
});

export const DELETE = withUserAuth(async (_req, session) => {
  const user = await prisma.user.findUnique({
    where: { id: session.user.userId },
    select: { avatarPath: true },
  });

  if (!user) {
    throw new NotFoundError("ユーザーが見つかりません");
  }

  if (!user.avatarPath) {
    return NextResponse.json({ message: "アバターは設定されていません" });
  }

  await deleteFile(user.avatarPath);

  await prisma.user.update({
    where: { id: session.user.userId },
    data: { avatarPath: null },
  });

  return NextResponse.json({ message: "アバターを削除しました" });
});
