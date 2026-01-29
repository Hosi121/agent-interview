import { NextResponse } from "next/server";
import { withUserAuth } from "@/lib/api-utils";
import { NotFoundError } from "@/lib/errors";
import { generateAgentSystemPrompt } from "@/lib/openai";
import { prisma } from "@/lib/prisma";

export const POST = withUserAuth(async (req, session) => {
  const fragments = await prisma.fragment.findMany({
    where: { userId: session.user.userId },
  });

  const user = await prisma.user.findUnique({
    where: { id: session.user.userId },
  });

  if (!user) {
    throw new NotFoundError("ユーザーが見つかりません");
  }

  let systemPrompt: string;

  if (fragments.length === 0) {
    systemPrompt = `あなたは${user.name}さんを代理するAIエージェントです。
採用担当者からの質問に対して、${user.name}さんの代わりに回答してください。
まだ詳細な情報が収集されていないため、一般的な回答になる場合があります。
丁寧かつ専門的な態度で対応し、分からないことは正直に伝えてください。`;
  } else {
    systemPrompt = await generateAgentSystemPrompt(
      fragments.map((f) => ({ type: f.type, content: f.content })),
      user.name,
    );
  }

  const existingAgent = await prisma.agentProfile.findUnique({
    where: { userId: session.user.userId },
  });

  let agent;

  if (existingAgent) {
    agent = await prisma.agentProfile.update({
      where: { userId: session.user.userId },
      data: { systemPrompt },
    });
  } else {
    agent = await prisma.agentProfile.create({
      data: {
        userId: session.user.userId,
        systemPrompt,
      },
    });
  }

  return NextResponse.json({ agent });
});
