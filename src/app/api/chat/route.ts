import { type FragmentType, SourceType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withUserValidation } from "@/lib/api-utils";
import { calculateCoverage } from "@/lib/coverage";
import { logger } from "@/lib/logger";
import {
  extractFragments,
  FRAGMENT_CONTENT_TRUNCATE,
  streamChatResponse,
} from "@/lib/openai";
import { prisma } from "@/lib/prisma";
import type { ChatCoverageState } from "@/types";

const BASE_SYSTEM_PROMPT = `あなたは求職者からキャリア情報を収集するインタビュアーAIです。
友好的で専門的な態度で、以下の情報を自然な会話を通じて収集してください：

1. 職歴と経験
2. スキルと専門知識
3. 達成した成果
4. 困難を乗り越えた経験
5. 今後のキャリア目標

## 応答ルール
- 1回の応答につき質問は1つだけにしてください。
- 質問は1〜2文で簡潔にしてください。
- 相手の回答への短いリアクション（1文）＋ 次の質問（1〜2文）の構成にしてください。
- 長い前置きや説明は不要です。
- より深い情報を引き出すフォローアップ質問をしてください。
- 具体的なエピソードや数字を含む回答を促してください。
日本語で回答してください。`;

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
        `- [${f.type}] ${f.content.length > FRAGMENT_CONTENT_TRUNCATE ? `${f.content.slice(0, FRAGMENT_CONTENT_TRUNCATE)}…` : f.content}`,
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
  prompt +=
    "\n1回の応答では、短いリアクション（1文）＋質問1つ（1〜2文）の構成で簡潔に述べてください。";

  return prompt;
}

const NEW_MESSAGE_COUNT = 4;
const CONTEXT_MESSAGE_COUNT = 4;

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

    const existingFragments = await prisma.fragment.findMany({
      where: { userId: session.user.userId },
      select: { type: true, content: true },
    });

    const coverage = calculateCoverage(existingFragments);
    const systemPrompt = buildSystemPrompt(existingFragments, coverage);

    const abortController = new AbortController();
    req.signal.addEventListener("abort", () => abortController.abort());
    const result = streamChatResponse(systemPrompt, chatMessages, {
      abortSignal: abortController.signal,
    });
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    const writeSSE = async (event: string, data: string) => {
      try {
        await writer.write(
          encoder.encode(`event: ${event}\ndata: ${data}\n\n`),
        );
      } catch {
        abortController.abort();
        throw new Error("Client disconnected");
      }
    };

    (async () => {
      try {
        let fullText = "";
        for await (const chunk of result.textStream) {
          fullText += chunk;
          await writeSSE("text", JSON.stringify(chunk));
        }

        let fragmentsExtracted = 0;
        let currentCoverage = coverage;

        const userMessages = messages.filter((m) => m.role === "user");
        if (userMessages.length > 0 && userMessages.length % 2 === 0) {
          try {
            const allMessages = [
              ...messages,
              { role: "assistant" as const, content: fullText },
            ];

            const newMessages = allMessages.slice(-NEW_MESSAGE_COUNT);
            const newMessagesText = newMessages
              .map((m) => `${m.role}: ${m.content}`)
              .join("\n");

            const contextStart = Math.max(
              0,
              allMessages.length - NEW_MESSAGE_COUNT - CONTEXT_MESSAGE_COUNT,
            );
            const contextEnd = allMessages.length - NEW_MESSAGE_COUNT;
            const contextMessages = allMessages.slice(contextStart, contextEnd);
            const contextMessagesText =
              contextMessages.length > 0
                ? contextMessages
                    .map((m) => `${m.role}: ${m.content}`)
                    .join("\n")
                : undefined;

            const extractedData = await extractFragments(newMessagesText, {
              existingFragments,
              contextMessages: contextMessagesText,
            });

            if (extractedData.fragments && extractedData.fragments.length > 0) {
              await prisma.fragment.createMany({
                data: extractedData.fragments.map((fragment) => ({
                  userId: session.user.userId,
                  type: (fragment.type as FragmentType) || "FACT",
                  content: fragment.content,
                  skills: fragment.skills || [],
                  keywords: fragment.keywords || [],
                  sourceType: SourceType.CONVERSATION,
                  confidence: 0.8,
                })),
              });
              fragmentsExtracted = extractedData.fragments.length;

              const allFragments = await prisma.fragment.findMany({
                where: { userId: session.user.userId },
                select: { type: true },
              });
              currentCoverage = calculateCoverage(allFragments);
            }
          } catch (extractError) {
            logger.error("Fragment extraction error", extractError as Error, {
              userId: session.user.userId,
            });
          }
        }

        await writeSSE(
          "metadata",
          JSON.stringify({
            fragmentsExtracted,
            coverage: currentCoverage,
          }),
        );
      } catch (error) {
        logger.error("Streaming error", error as Error, {
          userId: session.user.userId,
        });
        try {
          await writeSSE(
            "error",
            JSON.stringify({
              message: "ストリーミング中にエラーが発生しました",
            }),
          );
        } catch {
          // client disconnected
        }
      } finally {
        try {
          await writer.close();
        } catch {
          // already closed
        }
      }
    })();

    return new NextResponse(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  },
);
