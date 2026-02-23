import { SourceType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withUserValidation } from "@/lib/api-utils";
import { calculateCoverage } from "@/lib/coverage";
import { ForbiddenError } from "@/lib/errors";
import { parseFragmentType, qualityToConfidence } from "@/lib/fragment-utils";
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
- **具体性を引き出す**: 具体的なエピソードや数値を自然に促す。ただし毎回「具体的に」と聞くのではなく、「何人くらいのチームでしたか？」「どのくらいの期間で？」のように観点を変えて聞く。
- 相手が具体的に答えたら、その情報を認めてから次の角度へ深掘りする。
- 相手が抽象的な回答をした場合、一度だけ具体化を促す。2回続けて抽象的なら、別の角度か話題へ移る。

## 応答の構成
- 1回の応答につき質問は1つだけ。全体で2〜3文。
- 以下のバリエーションを使い分け、毎回同じパターンにならないようにする:
  A) 相手の発言の要点を自分の言葉で言い換え + 質問
  B) 自分の感想や着眼点を一言添え + 質問（例:「Kafkaを選んだのは堅実な判断ですね」）
  C) 前の話題とのつながりに触れ + 質問（例:「先ほどのチーム体制の話とも関係しそうですが」）
- 「すごいですね！」「素晴らしいですね！」のような定型リアクションを連続で使わない。
- 長い前置きや説明は不要。
- 日本語で回答。`;

/** LLMに送るメッセージの最大件数（古いメッセージは切り捨て） */
const MAX_LLM_MESSAGES = 50;

function appendCorrectionContext(
  prompt: string,
  correctFragment?: { type: string; content: string; skills: string[] } | null,
): string {
  if (!correctFragment) return prompt;
  const skillsText =
    correctFragment.skills.length > 0
      ? `\n- スキル: ${correctFragment.skills.join(", ")}`
      : "";
  return `${prompt}\n\n## 修正対象\nユーザーは以下の記憶のかけらの修正を希望しています:\n- 種類: ${correctFragment.type}\n- 内容:\n\`\`\`\n${correctFragment.content}\n\`\`\`${skillsText}\nユーザーの修正意図を踏まえて、正確な情報を引き出してください。\n修正が完了したら通常の会話に戻ってください。`;
}

function buildSystemPrompt(
  fragments: { type: string; content: string; confidence?: number }[],
  coverage: ChatCoverageState,
  correctFragment?: { type: string; content: string; skills: string[] } | null,
): string {
  if (fragments.length === 0) {
    return appendCorrectionContext(BASE_SYSTEM_PROMPT, correctFragment);
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
    prompt +=
      "\n- 話題を切り替えるときは、前の話題から自然に接続してください（例:「チーム体制の話が出ましたが、その中でご自身はどんな役割でしたか？」）。";
  } else {
    prompt +=
      "\n情報は十分に収集されています。会話をまとめる方向に導いてください。";
  }
  prompt += "\n既に収集済みの情報について同じ質問を繰り返さないでください。";
  prompt +=
    "\n\n## 中間まとめ\n会話が5〜6往復を超えたら、次の質問の前に「ここまでのお話をまとめると、○○と△△のご経験が中心ですね」のように1〜2文で整理してから次の話題に移ってください。毎回まとめる必要はありません。";

  return appendCorrectionContext(prompt, correctFragment);
}

/**
 * 初回セッション用の挨拶メッセージを生成（サーバー側）
 * クライアントの buildInitialMessage と同等の役割
 */
function buildServerGreeting(
  userName: string | undefined,
  fragmentCount: number,
): string {
  const name = userName ? `${userName}さん` : "";

  if (fragmentCount === 0) {
    return `こんにちは${name ? `、${name}` : ""}！あなたのキャリアを代わりに伝えてくれるAIエージェントを一緒に作りましょう。

まずは気軽に、これまでのお仕事やご経験について聞かせてください。印象に残っているプロジェクトの話でも、今やっていることでも、何でも大丈夫です。`;
  }

  // Fragmentあり（書類アップロード等）だが初チャットの場合
  return `こんにちは${name ? `、${name}` : ""}！すでにいくつかの情報をいただいています。ここからはもう少し詳しくお話を聞かせてください。

たとえば、お仕事の中で特に印象に残っているプロジェクトや、ご自身が工夫されたことなどがあれば教えてください。`;
}

const NEW_MESSAGE_COUNT = 4;
const CONTEXT_MESSAGE_COUNT = 4;

const chatSchema = z.object({
  message: z.string().min(1).max(5000),
  correctFragmentId: z.string().uuid().optional(),
});

export const POST = withUserValidation(
  chatSchema,
  async (body, req, session) => {
    const { message, correctFragmentId } = body;

    // セッション取得/作成
    const chatSession = await getOrCreateUserAIChatSession(
      session.user.userId,
      MAX_LLM_MESSAGES + 10,
    );

    // 修正対象フラグメントの取得
    let correctFragment: {
      id: string;
      type: string;
      content: string;
      skills: string[];
    } | null = null;
    if (correctFragmentId) {
      const fragment = await prisma.fragment.findUnique({
        where: { id: correctFragmentId },
      });
      if (fragment) {
        if (fragment.userId !== session.user.userId) {
          throw new ForbiddenError(
            "このフラグメントを修正する権限がありません",
          );
        }
        correctFragment = {
          id: fragment.id,
          type: fragment.type,
          content: fragment.content,
          skills: fragment.skills,
        };
      }
      // fragment が null の場合はスキップ（既に削除済み）
    }

    const existingFragments = await prisma.fragment.findMany({
      where: { userId: session.user.userId },
      select: { id: true, type: true, content: true, confidence: true },
    });

    const coverage = calculateCoverage(existingFragments);

    // 修正1: 初回セッション時に挨拶をDBに保存してLLMコンテキストを維持
    if (chatSession.messages.length === 0) {
      const greeting = buildServerGreeting(
        session.user.name ?? undefined,
        existingFragments.length,
      );
      await addMessage(chatSession.id, "AI", greeting);
      chatSession.messages.push({
        id: "",
        sessionId: chatSession.id,
        senderType: "AI",
        senderId: null,
        content: greeting,
        createdAt: new Date(),
      });
    }

    // 修正2: リトライ時の重複ユーザーメッセージ防止
    const lastMessage = chatSession.messages[chatSession.messages.length - 1];
    const isDuplicate =
      lastMessage &&
      lastMessage.senderType === "USER" &&
      lastMessage.content === message;
    if (!isDuplicate) {
      await addMessage(chatSession.id, "USER", message, session.user.userId);
    }

    // DB上の既存メッセージ + 今回のメッセージでLLMに送信
    const allDbMessages = [
      ...chatSession.messages.map((m) => ({
        role: (m.senderType === "USER" ? "user" : "assistant") as
          | "user"
          | "assistant",
        content: m.content,
      })),
      ...(isDuplicate ? [] : [{ role: "user" as const, content: message }]),
    ];

    // 修正3: LLMに送るメッセージ数を制限
    const dbMessages =
      allDbMessages.length > MAX_LLM_MESSAGES
        ? allDbMessages.slice(-MAX_LLM_MESSAGES)
        : allDbMessages;

    const systemPrompt = buildSystemPrompt(
      existingFragments,
      coverage,
      correctFragment,
    );

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

        // 修正2: AI応答のDB保存をリトライ付きで実行
        try {
          await addMessage(chatSession.id, "AI", fullText);
        } catch (saveError) {
          logger.error("AI message save failed, retrying", saveError as Error, {
            userId: session.user.userId,
          });
          await addMessage(chatSession.id, "AI", fullText);
        }

        let fragmentsExtracted = 0;
        let extractedFragmentDetails: {
          type: string;
          content: string;
          skills: string[];
        }[] = [];
        let pendingCorrection:
          | {
              type: string;
              content: string;
              skills: string[];
              keywords: string[];
              quality: string;
            }[]
          | null = null;
        let currentCoverage = coverage;

        // 修正6: 新コードでは必ずユーザーメッセージがあるため常に抽出実行
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

          // 修正対象フラグメントを除外（重複検出で弾かれるのを防ぐ）
          const fragmentsForExtraction = correctFragment
            ? existingFragments.filter((f) => f.id !== correctFragment.id)
            : existingFragments;

          const extractedData = await extractFragments(newMessagesText, {
            existingFragments: fragmentsForExtraction,
            contextMessages: contextMessagesText,
          });

          if (extractedData.fragments && extractedData.fragments.length > 0) {
            if (correctFragment) {
              // 修正モード: 確認用にクライアントに返す（自動適用しない）
              // /correct エンドポイントのスキーマ制約に合わせてクランプ
              const QUALITY_VALUES = ["low", "medium", "high"];
              pendingCorrection = extractedData.fragments
                .slice(0, 10)
                .map((f) => ({
                  type: parseFragmentType(f.type),
                  content: f.content.slice(0, 2000),
                  skills: (f.skills || [])
                    .slice(0, 20)
                    .map((s) => s.slice(0, 100)),
                  keywords: (f.keywords || [])
                    .slice(0, 20)
                    .map((k) => k.slice(0, 100)),
                  quality: QUALITY_VALUES.includes(f.quality ?? "")
                    ? (f.quality as string)
                    : "medium",
                }));
            } else {
              await prisma.fragment.createMany({
                data: extractedData.fragments.map((fragment) => ({
                  userId: session.user.userId,
                  type: parseFragmentType(fragment.type),
                  content: fragment.content,
                  skills: fragment.skills || [],
                  keywords: fragment.keywords || [],
                  sourceType: SourceType.CONVERSATION,
                  confidence:
                    qualityToConfidence[fragment.quality ?? "medium"] ?? 0.7,
                })),
              });
              fragmentsExtracted = extractedData.fragments.length;
              extractedFragmentDetails = extractedData.fragments.map((f) => ({
                type: parseFragmentType(f.type),
                content: f.content,
                skills: f.skills || [],
              }));

              const allFragments = await prisma.fragment.findMany({
                where: { userId: session.user.userId },
                select: { type: true },
              });
              currentCoverage = calculateCoverage(allFragments);
            }
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
            fragments: extractedFragmentDetails,
            pendingCorrection,
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
