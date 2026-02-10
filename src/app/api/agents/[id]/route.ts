import { NextResponse } from "next/server";
import { isCompanyAccessDenied } from "@/lib/access-control";
import { withRecruiterAuth } from "@/lib/api-utils";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withRecruiterAuth<RouteContext>(
  async (req, session, context) => {
    const { id } = await context.params;

    const agent = await prisma.agentProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!agent) {
      throw new NotFoundError("エージェントが見つかりません");
    }

    if (agent.status !== "PUBLIC") {
      throw new ForbiddenError("このエージェントは公開されていません");
    }

    if (await isCompanyAccessDenied(session.user.companyId, agent.userId)) {
      throw new ForbiddenError("アクセスが拒否されています");
    }

    const fragments = await prisma.fragment.findMany({
      where: { userId: agent.userId },
      select: {
        type: true,
        content: true,
        skills: true,
      },
    });

    return NextResponse.json({
      agent: {
        ...agent,
        fragments,
      },
    });
  },
);
