import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { uploadFile } from "@/lib/minio";
import { prisma } from "@/lib/prisma";

// ファイルアップロード制限
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// ファイル名のサニタイズ（パストラバーサル対策）
function sanitizeFileName(name: string): string {
  return name
    .replace(/[/\\?%*:|"<>]/g, "-") // 危険な文字を置換
    .replace(/\.{2,}/g, ".") // 連続ドットを単一に
    .slice(0, 255); // 長さ制限
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const documents = await prisma.document.findMany({
      where: { userId: session.user.userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error("Get documents error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // ファイルサイズチェック
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "ファイルサイズは10MB以下にしてください" },
        { status: 400 },
      );
    }

    // MIMEタイプチェック
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error:
            "対応していないファイル形式です。PDF、テキスト、Word文書のみ対応しています",
        },
        { status: 400 },
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

    return NextResponse.json({ document });
  } catch (error) {
    console.error("Upload document error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
