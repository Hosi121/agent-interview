import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateChatResponse } from "@/lib/openai";
import {
  checkPointBalance,
  consumePoints,
  InsufficientPointsError,
  NoSubscriptionError,
} from "@/lib/points";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.recruiterId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { message } = await req.json();

    const agent = await prisma.agentProfile.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (agent.status !== "PUBLIC") {
      return NextResponse.json(
        { error: "Agent is not public" },
        { status: 403 },
      );
    }

    let chatSession = await prisma.session.findFirst({
      where: {
        recruiterId: session.user.recruiterId,
        agentId: id,
        sessionType: "RECRUITER_AGENT_CHAT",
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    const isNewSession = !chatSession;

    // 新規セッション作成時はポイントをチェック・消費
    if (isNewSession) {
      const pointCheck = await checkPointBalance(
        session.user.recruiterId,
        "CONVERSATION",
      );
      if (!pointCheck.canProceed) {
        return NextResponse.json(
          {
            error: "ポイントが不足しています",
            required: pointCheck.required,
            available: pointCheck.available,
          },
          { status: 402 },
        );
      }

      chatSession = await prisma.session.create({
        data: {
          sessionType: "RECRUITER_AGENT_CHAT",
          recruiterId: session.user.recruiterId,
          agentId: id,
        },
        include: {
          messages: true,
        },
      });

      // ポイント消費
      await consumePoints(
        session.user.recruiterId,
        "CONVERSATION",
        chatSession.id,
        `エージェント会話: ${agent.user.name}`,
      );
    }

    // TypeScript型絞り込み（既存セッション取得または新規作成のどちらかで必ず存在）
    if (!chatSession) {
      throw new Error("Failed to create or find chat session");
    }

    await prisma.message.create({
      data: {
        sessionId: chatSession.id,
        senderType: "RECRUITER",
        senderId: session.user.recruiterId,
        content: message,
      },
    });

    const previousMessages = chatSession.messages.map((m) => ({
      role: (m.senderType === "RECRUITER" ? "user" : "assistant") as
        | "user"
        | "assistant",
      content: m.content,
    }));

    const fragments = await prisma.fragment.findMany({
      where: { userId: agent.userId },
    });

    const fragmentsContext = fragments
      .map((f) => `[${f.type}]: ${f.content}`)
      .join("\n");

    const enhancedSystemPrompt = `${agent.systemPrompt}

以下は${agent.user.name}さんに関する情報です。この情報を参考にして回答してください：

${fragmentsContext || "（詳細な情報はまだ収集されていません）"}

採用担当者からの質問に対して、${agent.user.name}さんの代理として丁寧かつ専門的に回答してください。
わからないことは正直に「その点についてはまだ情報を持っていません」と答えてください。`;

    const responseMessage = await generateChatResponse(enhancedSystemPrompt, [
      ...previousMessages,
      { role: "user", content: message },
    ]);

    await prisma.message.create({
      data: {
        sessionId: chatSession.id,
        senderType: "AI",
        content: responseMessage,
      },
    });

    return NextResponse.json({ message: responseMessage });
  } catch (error) {
    console.error("Interview chat error:", error);

    if (error instanceof NoSubscriptionError) {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }

    if (error instanceof InsufficientPointsError) {
      return NextResponse.json(
        {
          error: error.message,
          required: error.required,
          available: error.available,
        },
        { status: 402 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
