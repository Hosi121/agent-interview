import { NextResponse } from "next/server";
import { withUserAuth } from "@/lib/api-utils";
import { detectContentType, sanitizeFileName } from "@/lib/avatar-utils";
import { NotFoundError, ValidationError } from "@/lib/errors";
import {
  deleteFile,
  getFileUrl,
  invalidateUrlCache,
  uploadFile,
} from "@/lib/minio";
import { prisma } from "@/lib/prisma";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

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

  const detectedType = detectContentType(buffer);
  if (!detectedType) {
    throw new ValidationError("ファイルの内容が画像形式と一致しません");
  }

  const sanitizedFileName = sanitizeFileName(file.name);
  const avatarPath = await uploadFile(
    `avatars/${session.user.userId}/${sanitizedFileName}`,
    buffer,
    detectedType,
  );

  try {
    // トランザクションで旧パスの取得と新パスへの更新をアトミックに実行
    const oldAvatarPath = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: session.user.userId },
        select: { avatarPath: true },
      });
      await tx.user.update({
        where: { id: session.user.userId },
        data: { avatarPath },
      });
      return user?.avatarPath;
    });

    // 旧アバターファイルを削除（失敗しても継続）
    if (oldAvatarPath) {
      invalidateUrlCache(oldAvatarPath);
      try {
        await deleteFile(oldAvatarPath);
      } catch (e) {
        console.error("Failed to delete old avatar:", e);
      }
    }
  } catch (e) {
    // DB更新失敗時はアップロード済みファイルを削除
    try {
      await deleteFile(avatarPath);
    } catch {
      console.error("Failed to rollback uploaded avatar:", avatarPath);
    }
    throw e;
  }

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

  const { avatarPath } = user;

  // DB更新を先に行い、S3削除失敗時も孤立ファイルが残るだけで済むようにする
  await prisma.user.update({
    where: { id: session.user.userId },
    data: { avatarPath: null },
  });

  invalidateUrlCache(avatarPath);

  try {
    await deleteFile(avatarPath);
  } catch (e) {
    console.error("Failed to delete avatar file:", e);
  }

  return NextResponse.json({ message: "アバターを削除しました" });
});
