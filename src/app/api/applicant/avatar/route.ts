import { NextResponse } from "next/server";
import { withUserAuth } from "@/lib/api-utils";
import {
  detectContentType,
  processImage,
  sanitizeFileName,
} from "@/lib/avatar-utils";
import { NotFoundError, ValidationError } from "@/lib/errors";
import {
  deleteFile,
  getFileUrl,
  invalidateUrlCache,
  uploadFile,
} from "@/lib/minio";
import { prisma } from "@/lib/prisma";

export const GET = withUserAuth(async (_req, session) => {
  const user = await prisma.user.findUnique({
    where: { id: session.user.userId },
    select: { avatarPath: true },
  });

  if (!user?.avatarPath) {
    return NextResponse.json(null, { status: 404 });
  }

  const url = await getFileUrl(user.avatarPath);
  return NextResponse.redirect(url);
});

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const POST = withUserAuth(async (req, session) => {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
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

  // マジックバイトで実際の画像形式を判定（file.typeはクライアント申告値のため信頼しない）
  const detectedType = detectContentType(buffer);
  if (!detectedType) {
    throw new ValidationError("ファイルの内容が画像形式と一致しません");
  }

  // EXIFメタデータ除去 + 512x512リサイズ
  const processedBuffer = await processImage(buffer, detectedType);

  const sanitizedFileName = sanitizeFileName(file.name);
  const avatarPath = await uploadFile(
    `avatars/${session.user.userId}/${sanitizedFileName}`,
    processedBuffer,
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

  // 同時アップロードで上書きされた場合、孤立ファイルをクリーンアップ
  const freshUser = await prisma.user.findUnique({
    where: { id: session.user.userId },
    select: { avatarPath: true },
  });
  if (freshUser?.avatarPath && freshUser.avatarPath !== avatarPath) {
    try {
      await deleteFile(avatarPath);
    } catch (e) {
      console.error("Failed to cleanup orphaned avatar:", e);
    }
    const avatarUrl = await getFileUrl(freshUser.avatarPath);
    return NextResponse.json({ avatarUrl }, { status: 201 });
  }

  const avatarUrl = await getFileUrl(avatarPath);

  return NextResponse.json({ avatarUrl }, { status: 201 });
});

export const DELETE = withUserAuth(async (_req, session) => {
  // トランザクションで読み取りと更新をアトミックに実行（レースコンディション対策）
  const avatarPath = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: session.user.userId },
      select: { avatarPath: true },
    });

    if (!user) {
      throw new NotFoundError("ユーザーが見つかりません");
    }

    if (!user.avatarPath) {
      return null;
    }

    await tx.user.update({
      where: { id: session.user.userId },
      data: { avatarPath: null },
    });

    return user.avatarPath;
  });

  if (!avatarPath) {
    return NextResponse.json({ message: "アバターは設定されていません" });
  }

  invalidateUrlCache(avatarPath);

  try {
    await deleteFile(avatarPath);
  } catch (e) {
    console.error("Failed to delete avatar file:", e);
  }

  return NextResponse.json({ message: "アバターを削除しました" });
});
