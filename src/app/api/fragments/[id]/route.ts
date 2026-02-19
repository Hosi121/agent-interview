import { NextResponse } from "next/server";
import { withUserAuth } from "@/lib/api-utils";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { deleteFragmentWithRelations } from "@/lib/fragment-utils";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = withUserAuth<RouteContext>(async (req, session, context) => {
  const { id } = await context.params;

  if (!UUID_REGEX.test(id)) {
    throw new ValidationError("無効なフラグメントIDです");
  }

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

    if (!UUID_REGEX.test(id)) {
      throw new ValidationError("無効なフラグメントIDです");
    }

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
      await deleteFragmentWithRelations(tx, id);
    });

    return NextResponse.json({ success: true });
  },
);
