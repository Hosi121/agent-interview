import { type NextRequest, NextResponse } from "next/server";
import { isCompanyAccessDenied } from "@/lib/access-control";
import { withRecruiterAuth } from "@/lib/api-utils";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withRecruiterAuth<RouteContext>(
  async (req, session, context) => {
    const { id } = await context!.params;

    const agent = await prisma.agentProfile.findUnique({
      where: { id },
      select: {
        userId: true,
        status: true,
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

    const chatSession = await prisma.session.findFirst({
      where: {
        recruiterId: session.user.recruiterId,
        agentId: id,
        sessionType: "RECRUITER_AGENT_CHAT",
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            references: true,
          },
        },
      },
    });

    if (!chatSession) {
      return NextResponse.json({ messages: [] });
    }

    // 参照されているフラグメントIDを収集
    const fragmentIds = chatSession.messages
      .flatMap((m) => m.references)
      .filter((ref) => ref.refType === "FRAGMENT")
      .map((ref) => ref.refId);

    // フラグメントを取得
    const fragments =
      fragmentIds.length > 0
        ? await prisma.fragment.findMany({
            where: { id: { in: fragmentIds } },
            select: {
              id: true,
              type: true,
              content: true,
              skills: true,
            },
          })
        : [];

    const fragmentMap = new Map(fragments.map((f) => [f.id, f]));

    // メッセージにreferencesを追加
    const messagesWithReferences = chatSession.messages.map((message) => {
      const references = message.references
        .filter((ref) => ref.refType === "FRAGMENT")
        .map((ref) => {
          const fragment = fragmentMap.get(ref.refId);
          if (!fragment) return null;
          return {
            id: fragment.id,
            type: fragment.type,
            content:
              fragment.content.length > 100
                ? fragment.content.substring(0, 100) + "..."
                : fragment.content,
            skills: fragment.skills,
          };
        })
        .filter(Boolean);

      return {
        id: message.id,
        sessionId: message.sessionId,
        senderType: message.senderType,
        senderId: message.senderId,
        content: message.content,
        createdAt: message.createdAt,
        references: references.length > 0 ? references : undefined,
      };
    });

    return NextResponse.json({ messages: messagesWithReferences });
  },
);
