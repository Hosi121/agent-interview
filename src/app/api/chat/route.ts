import { type FragmentType, SourceType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withUserValidation } from "@/lib/api-utils";
import { calculateCoverage } from "@/lib/coverage";
import { logger } from "@/lib/logger";
import { extractFragments, generateChatResponse } from "@/lib/openai";
import { prisma } from "@/lib/prisma";

const SYSTEM_PROMPT = `あなたは求職者からキャリア情報を収集するインタビュアーAIです。
友好的で専門的な態度で、以下の情報を自然な会話を通じて収集してください：

1. 職歴と経験
2. スキルと専門知識
3. 達成した成果
4. 困難を乗り越えた経験
5. 今後のキャリア目標

各回答に対して、より深い情報を引き出すフォローアップ質問をしてください。
具体的なエピソードや数字を含む回答を促してください。
日本語で回答してください。`;

const chatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    }),
  ),
});

export const POST = withUserValidation(
  chatSchema,
  async (body, req, session) => {
    const { messages } = body;

    const chatMessages = messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const responseMessage = await generateChatResponse(
      SYSTEM_PROMPT,
      chatMessages,
    );

    let fragmentsExtracted = 0;

    const userMessages = messages.filter((m) => m.role === "user");
    if (userMessages.length > 0 && userMessages.length % 3 === 0) {
      try {
        const conversationText = messages
          .map((m) => `${m.role}: ${m.content}`)
          .join("\n");

        const extractedData = await extractFragments(conversationText);

        if (extractedData.fragments && extractedData.fragments.length > 0) {
          for (const fragment of extractedData.fragments) {
            await prisma.fragment.create({
              data: {
                userId: session.user.userId,
                type: (fragment.type as FragmentType) || "FACT",
                content: fragment.content,
                skills: fragment.skills || [],
                keywords: fragment.keywords || [],
                sourceType: SourceType.CONVERSATION,
                confidence: 0.8,
              },
            });
            fragmentsExtracted++;
          }
        }
      } catch (extractError) {
        logger.error("Fragment extraction error", extractError as Error, {
          userId: session.user.userId,
        });
      }
    }

    // 全フラグメントを取得して網羅度を計算
    const allFragments = await prisma.fragment.findMany({
      where: { userId: session.user.userId },
      select: { type: true },
    });

    const coverage = calculateCoverage(allFragments);

    return NextResponse.json({
      message: responseMessage,
      fragmentsExtracted,
      coverage,
    });
  },
);
