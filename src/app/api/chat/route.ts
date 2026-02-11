import { type FragmentType, SourceType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withUserValidation } from "@/lib/api-utils";
import { calculateCoverage } from "@/lib/coverage";
import { logger } from "@/lib/logger";
import { extractFragments, generateChatResponse } from "@/lib/openai";
import { prisma } from "@/lib/prisma";
import type { ChatCoverageState } from "@/types";

const BASE_SYSTEM_PROMPT = `あなたは求職者からキャリア情報を収集するインタビュアーAIです。
友好的で専門的な態度で、以下の情報を自然な会話を通じて収集してください：

1. 職歴と経験
2. スキルと専門知識
3. 達成した成果
4. 困難を乗り越えた経験
5. 今後のキャリア目標

各回答に対して、より深い情報を引き出すフォローアップ質問をしてください。
具体的なエピソードや数字を含む回答を促してください。
日本語で回答してください。`;

const FRAGMENT_CONTENT_MAX_LENGTH = 100;

function buildSystemPrompt(
  fragments: { type: string; content: string }[],
  coverage: ChatCoverageState,
): string {
  if (fragments.length === 0) {
    return BASE_SYSTEM_PROMPT;
  }

  let prompt = BASE_SYSTEM_PROMPT;

  const fragmentsSummary = fragments
    .map(
      (f) =>
        `- [${f.type}] ${f.content.length > FRAGMENT_CONTENT_MAX_LENGTH ? `${f.content.slice(0, FRAGMENT_CONTENT_MAX_LENGTH)}…` : f.content}`,
    )
    .join("\n");

  const fulfilledCategories = coverage.categories
    .filter((c) => c.fulfilled)
    .map((c) => `- ${c.label} ✓`)
    .join("\n");

  const missingCategories = coverage.categories
    .filter((c) => !c.fulfilled)
    .map((c) => `- ${c.label}（${c.current}/${c.required}件）`)
    .join("\n");

  prompt += `\n\n## 収集済みの情報\n${fragmentsSummary}`;
  prompt += `\n\n## カバレッジ状況（${coverage.percentage}%）`;
  prompt += `\n### 充足済み\n${fulfilledCategories || "なし"}`;
  prompt += `\n### 不足カテゴリ\n${missingCategories || "なし"}`;

  prompt += "\n\n## 指示";
  if (!coverage.isReadyToFinish) {
    prompt += "\n不足しているカテゴリを優先的に聞き出してください。";
  } else if (!coverage.isComplete) {
    prompt +=
      "\nほぼ情報は揃っています。残りの不足カテゴリについて軽く触れてください。";
  } else {
    prompt +=
      "\n情報は十分に収集されています。会話をまとめる方向に導いてください。";
  }
  prompt += "\nただし自然な会話を心がけ、尋問にならないようにしてください。";
  prompt += "\n既に収集済みの情報について同じ質問を繰り返さないでください。";

  return prompt;
}

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

    // 既存Fragmentを取得してカバレッジを計算し、動的プロンプトを構築
    const existingFragments = await prisma.fragment.findMany({
      where: { userId: session.user.userId },
      select: { type: true, content: true },
    });

    let coverage = calculateCoverage(existingFragments);
    const systemPrompt = buildSystemPrompt(existingFragments, coverage);

    const responseMessage = await generateChatResponse(
      systemPrompt,
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

          // 新規Fragmentが追加された場合のみカバレッジを再計算
          const allFragments = await prisma.fragment.findMany({
            where: { userId: session.user.userId },
            select: { type: true },
          });
          coverage = calculateCoverage(allFragments);
        }
      } catch (extractError) {
        logger.error("Fragment extraction error", extractError as Error, {
          userId: session.user.userId,
        });
      }
    }

    return NextResponse.json({
      message: responseMessage,
      fragmentsExtracted,
      coverage,
    });
  },
);
