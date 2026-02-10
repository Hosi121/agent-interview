import { NextResponse } from "next/server";
import { z } from "zod";
import { withUserAuth } from "@/lib/api-utils";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { generateChatResponse } from "@/lib/openai";
import { prisma } from "@/lib/prisma";

const previewSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    }),
  ),
});

export const POST = withUserAuth(async (req, session) => {
  const rawBody = await req.json();
  const parsed = previewSchema.safeParse(rawBody);

  if (!parsed.success) {
    throw new ValidationError("入力内容に問題があります", {
      fields: parsed.error.flatten().fieldErrors,
    });
  }

  const { messages } = parsed.data;

  const agent = await prisma.agentProfile.findUnique({
    where: { userId: session.user.userId },
    include: {
      user: true,
    },
  });

  if (!agent) {
    throw new NotFoundError("エージェントがまだ作成されていません");
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

  const formattedMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const responseMessage = await generateChatResponse(
    previewSystemPrompt,
    formattedMessages,
  );

  return NextResponse.json({ message: responseMessage });
});
