import { NextResponse } from "next/server";
import { withUserAuth } from "@/lib/api-utils";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withUserAuth<RouteContext>(async (req, session, context) => {
  const { id } = await context.params;

  const fragment = await prisma.fragment.findUnique({
    where: { id },
  });

  if (!fragment) {
    throw new NotFoundError("フラグメントが見つかりません");
  }

  if (fragment.userId !== session.user.userId) {
    throw new ForbiddenError("このフラグメントにアクセスする権限がありません");
  }

  return NextResponse.json({ fragment });
});

export const DELETE = withUserAuth<RouteContext>(
  async (req, session, context) => {
    const { id } = await context.params;

    const fragment = await prisma.fragment.findUnique({
      where: { id },
    });

    if (!fragment) {
      throw new NotFoundError("フラグメントが見つかりません");
    }

    if (fragment.userId !== session.user.userId) {
      throw new ForbiddenError("このフラグメントを削除する権限がありません");
    }

    await prisma.$transaction(async (tx) => {
      // 関連する MessageReference を先に削除
      await tx.messageReference.deleteMany({
        where: { refType: "FRAGMENT", refId: id },
      });

      // 子フラグメントの parentId を null に更新
      await tx.fragment.updateMany({
        where: { parentId: id },
        data: { parentId: null },
      });

      // フラグメント本体を削除
      await tx.fragment.delete({
        where: { id },
      });
    });

    return NextResponse.json({ success: true });
  },
);
