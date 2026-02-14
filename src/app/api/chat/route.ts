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
import {
  addMessage,
  getOrCreateUserAIChatSession,
} from "@/lib/session-service";
import type { ChatCoverageState } from "@/types";

const BASE_SYSTEM_PROMPT = `あなたは求職者からキャリア情報を深く聞き出すインタビュアーAIです。
友好的で専門的な態度で、自然な会話を通じて情報を収集してください。

## 対話スタイル
- **1トピック深掘り**: ユーザーが話題を出したら、その話題について複数の角度（成果、工夫、困難、学び）から掘り下げてから次の話題へ移ること。
- **具体性を引き出す**: 「どのくらいの規模でしたか？」「数字で言うと？」「具体的にどんな工夫をしましたか？」のように具体的なエピソードや数値を自然に促す。
- 相手が具体的に答えたら、その情報を認めてから次の角度へ深掘りする。
- 相手が抽象的な回答をした場合、一度だけ具体化を促す。2回続けて抽象的なら、別の角度か話題へ移る。

## 応答ルール
- 1回の応答につき質問は1つだけ。
- 短いリアクション（1文）＋ 質問（1〜2文）の構成。
- 長い前置きや説明は不要。
- 日本語で回答。`;

const qualityToConfidence: Record<string, number> = {
  low: 0.4,
  medium: 0.7,
  high: 1.0,
};

function buildSystemPrompt(
  fragments: { type: string; content: string; confidence?: number }[],
  coverage: ChatCoverageState,
): string {
  if (fragments.length === 0) {
    return BASE_SYSTEM_PROMPT;
  }

  let prompt = BASE_SYSTEM_PROMPT;

  const fragmentsSummary = fragments
    .map((f) => {
      const truncated =
        f.content.length > FRAGMENT_CONTENT_TRUNCATE
          ? `${f.content.slice(0, FRAGMENT_CONTENT_TRUNCATE)}…`
          : f.content;
      const qualityMarker =
        f.confidence !== undefined && f.confidence <= 0.4 ? " ⚠具体性不足" : "";
      return `- [${f.type}] ${truncated}${qualityMarker}`;
    })
    .join("\n");

  const fulfilledCategories = coverage.categories
    .filter((c) => c.fulfilled)
    .map((c) => `- ${c.label} ✓`)
    .join("\n");

  const missingCategories = coverage.categories
    .filter((c) => !c.fulfilled)
    .map((c) => `- ${c.label}（${c.current}/${c.required}件）`)
    .join("\n");

  const missingCategoryNames = coverage.categories
    .filter((c) => !c.fulfilled)
    .map((c) => c.label);

  prompt += `\n\n## 収集済みの情報\n${fragmentsSummary}`;
  prompt += `\n\n## カバレッジ状況（${coverage.percentage}%）`;
  prompt += `\n### 充足済み\n${fulfilledCategories || "なし"}`;
  prompt += `\n### 不足カテゴリ\n${missingCategories || "なし"}`;

  prompt += "\n\n## 対話戦略";
  if (!coverage.isComplete) {
    prompt += `\n- ユーザーが今話しているトピックがあれば、そのトピックについて未収集の角度（特に: ${missingCategoryNames.join("、") || "なし"}）から深掘りしてください。`;
    prompt +=
      "\n- 今のトピックから自然に引き出せる情報がなくなったら、不足カテゴリに関連する新しい話題を振ってください。";
    prompt +=
      "\n- 「次は○○について教えてください」のような唐突な話題転換は避けてください。";
  } else {
    prompt +=
      "\n情報は十分に収集されています。会話をまとめる方向に導いてください。";
  }
  prompt += "\n既に収集済みの情報について同じ質問を繰り返さないでください。";

  return prompt;
}

const NEW_MESSAGE_COUNT = 4;
const CONTEXT_MESSAGE_COUNT = 4;

const chatSchema = z.object({
  message: z.string().min(1),
});

export const POST = withUserValidation(
  chatSchema,
  async (body, req, session) => {
    const { message } = body;

    // セッション取得/作成 + ユーザーメッセージ保存
    const chatSession = await getOrCreateUserAIChatSession(session.user.userId);
    await addMessage(chatSession.id, "USER", message, session.user.userId);

    // DB上の既存メッセージ + 今回のメッセージでLLMに送信
    const dbMessages = [
      ...chatSession.messages.map((m) => ({
        role: (m.senderType === "USER" ? "user" : "assistant") as
          | "user"
          | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    const existingFragments = await prisma.fragment.findMany({
      where: { userId: session.user.userId },
      select: { type: true, content: true, confidence: true },
    });

    const coverage = calculateCoverage(existingFragments);
    const systemPrompt = buildSystemPrompt(existingFragments, coverage);

    const abortController = new AbortController();
    req.signal.addEventListener("abort", () => abortController.abort());
    const result = streamChatResponse(systemPrompt, dbMessages, {
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

        // AI応答をDB保存
        await addMessage(chatSession.id, "AI", fullText);

        let fragmentsExtracted = 0;
        let currentCoverage = coverage;

        try {
          const allMessages = [
            ...dbMessages,
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
              ? contextMessages.map((m) => `${m.role}: ${m.content}`).join("\n")
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
                confidence:
                  qualityToConfidence[fragment.quality ?? "medium"] ?? 0.7,
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
