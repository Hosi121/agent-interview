import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.recruiterId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

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
  } catch (error) {
    console.error("Get messages error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
