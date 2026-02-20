import { NextResponse } from "next/server";
import { withUserAuth } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export const GET = withUserAuth(async (_req, session) => {
  const chatSession = await prisma.session.findFirst({
    where: {
      userId: session.user.userId,
      sessionType: "USER_AI_CHAT",
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: 500,
      },
    },
  });

  if (!chatSession) {
    return NextResponse.json({ messages: [] });
  }

  const messages = chatSession.messages.map((m) => ({
    id: m.id,
    senderType: m.senderType,
    content: m.content,
    createdAt: m.createdAt,
  }));

  return NextResponse.json({ messages });
});
