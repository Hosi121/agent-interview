import { NextResponse } from "next/server";
import { withUserAuth } from "@/lib/api-utils";
import { ValidationError } from "@/lib/errors";
import { uploadFile } from "@/lib/minio";
import { prisma } from "@/lib/prisma";

// ファイルアップロード制限
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  // Word（docx）のプレーンテキスト抽出に対応
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// ファイル名のサニタイズ（パストラバーサル対策）
function sanitizeFileName(name: string): string {
  return name
    .replace(/[/\\?%*:|"<>]/g, "-") // 危険な文字を置換
    .replace(/\.{2,}/g, ".") // 連続ドットを単一に
    .slice(0, 255); // 長さ制限
}

export const GET = withUserAuth(async (req, session) => {
  const documents = await prisma.document.findMany({
    where: { userId: session.user.userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ documents });
});

export const POST = withUserAuth(async (req, session) => {
  const formData = await req.formData();
  const file = formData.get("file") as File;

  if (!file) {
    throw new ValidationError("ファイルが指定されていません");
  }

  // ファイルサイズチェック
  if (file.size > MAX_FILE_SIZE) {
    throw new ValidationError("ファイルサイズは10MB以下にしてください");
  }

  // MIMEタイプチェック
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new ValidationError(
      "対応していないファイル形式です。PDF、テキスト、Word文書のみ対応しています",
    );
  }

  const sanitizedFileName = sanitizeFileName(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = await uploadFile(sanitizedFileName, buffer, file.type);

  const document = await prisma.document.create({
    data: {
      userId: session.user.userId,
      fileName: sanitizedFileName,
      filePath,
    },
  });

  return NextResponse.json({ document }, { status: 201 });
});
