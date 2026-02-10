import { NextResponse } from "next/server";
import { withUserAuth } from "@/lib/api-utils";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { deleteFile } from "@/lib/minio";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export const DELETE = withUserAuth<RouteContext>(
  async (req, session, context) => {
    const { id } = await context.params;

    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      throw new NotFoundError("ドキュメントが見つかりません");
    }

    if (document.userId !== session.user.userId) {
      throw new ForbiddenError("このドキュメントを削除する権限がありません");
    }

    try {
      await deleteFile(document.filePath);
    } catch (error) {
      logger.error("Failed to delete file from storage", error as Error, {
        documentId: id,
        filePath: document.filePath,
      });
    }

    await prisma.document.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  },
);
