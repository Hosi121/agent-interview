import { NextResponse } from "next/server";
import { withUserAuth } from "@/lib/api-utils";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { deleteFragmentWithRelations, UUID_REGEX } from "@/lib/fragment-utils";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withUserAuth<RouteContext>(async (req, session, context) => {
  const { id } = await context.params;

  if (!UUID_REGEX.test(id)) {
    throw new ValidationError("無効なフラグメントIDです");
  }

  const fragment = await prisma.fragment.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      content: true,
      skills: true,
      userId: true,
    },
  });

  if (!fragment) {
    throw new NotFoundError("フラグメントが見つかりません");
  }

  if (fragment.userId !== session.user.userId) {
    throw new ForbiddenError("このフラグメントにアクセスする権限がありません");
  }

  const { userId: _, ...fragmentData } = fragment;
  return NextResponse.json({ fragment: fragmentData });
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
