import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withUserAuth } from "@/lib/api-utils";
import { NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withUserAuth<RouteContext>(
  async (_req: NextRequest, session, context) => {
    const { id } = await context.params;

    const document = await prisma.document.findFirst({
      where: { id, userId: session.user.userId },
    });

    if (!document) {
      throw new NotFoundError("ドキュメントが見つかりません");
    }

    const fragments = await prisma.fragment.findMany({
      where: {
        userId: session.user.userId,
        sourceType: "DOCUMENT",
        sourceId: id,
      },
      select: {
        id: true,
        type: true,
        content: true,
        skills: true,
        keywords: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ fragments });
  },
);
