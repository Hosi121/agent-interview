import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateChatResponse } from "@/lib/openai";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages } = await req.json();

    const agent = await prisma.agentProfile.findUnique({
      where: { userId: session.user.userId },
      include: {
        user: true,
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "エージェントがまだ作成されていません" },
        { status: 404 }
      );
    }

    const fragments = await prisma.fragment.findMany({
      where: { userId: session.user.userId },
    });

    const fragmentsContext = fragments
      .map((f) => `[${f.type}]: ${f.content}`)
      .join("\n");

    const previewSystemPrompt = `${agent.systemPrompt}

以下は${agent.user.name}さんに関する情報です。この情報を参考にして回答してください：

${fragmentsContext || "（詳細な情報はまだ収集されていません）"}

これは${agent.user.name}さん本人によるプレビューテストです。
採用担当者からの質問を想定して、${agent.user.name}さんの代理として丁寧かつ専門的に回答してください。
わからないことは正直に「その点についてはまだ情報を持っていません」と答えてください。`;

    const formattedMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const responseMessage = await generateChatResponse(
      previewSystemPrompt,
      formattedMessages
    );

    return NextResponse.json({ message: responseMessage });
  } catch (error) {
    console.error("Agent preview error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
