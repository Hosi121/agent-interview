import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { NotFoundError } from "@/lib/errors";
import { getFileUrl } from "@/lib/minio";

// アバター画像を配信（presigned URL へリダイレクト）
export const GET = withAuth(
  async (_req, session, context: { params: Promise<{ path: string }> }) => {
    const { path } = await context.params;

    if (!path || !path.startsWith("avatars/")) {
      throw new NotFoundError("画像が見つかりません");
    }

    const url = await getFileUrl(path);
    return NextResponse.redirect(url);
  },
);
