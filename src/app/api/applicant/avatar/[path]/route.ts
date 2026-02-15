import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-utils";
import { NotFoundError } from "@/lib/errors";
import { getFileUrl } from "@/lib/minio";

// アバター画像を配信（presigned URL へリダイレクト）
export const GET = withErrorHandling(
  async (_req, context: { params: Promise<{ path: string }> }) => {
    const { path } = await context.params;

    if (!path) {
      throw new NotFoundError("画像が見つかりません");
    }

    const url = await getFileUrl(path);
    return NextResponse.redirect(url);
  },
);
