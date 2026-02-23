import { NextResponse } from "next/server";
import { z } from "zod";
import { isCompanyAccessDenied } from "@/lib/access-control";
import { withRecruiterAuth } from "@/lib/api-utils";
import { calculateCoverage } from "@/lib/coverage";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { generateChatResponse, generateFollowUpQuestions } from "@/lib/openai";
import { consumePointsWithOperations } from "@/lib/points";
import { prisma } from "@/lib/prisma";

/**
 * 同時リクエストによりセッションが既に存在していた場合にスローし、
 * トランザクションをロールバックしてポイント消費を防ぐ。
 */
class DuplicateSessionError extends Error {
  constructor() {
    super("Session already exists");
    this.name = "DuplicateSessionError";
  }
}

type RouteContext = { params: Promise<{ id: string }> };

const chatSchema = z.object({
  message: z.string().min(1, "メッセージは必須です").max(5000),
  jobId: z.string().optional(),
  missingInfo: z.array(z.string()).optional(),
});

export const POST = withRecruiterAuth<RouteContext>(
  async (req, session, context) => {
    const { id } = await context.params;
    const rawBody = await req.json();
    const parsed = chatSchema.safeParse(rawBody);

    if (!parsed.success) {
      throw new ValidationError("入力内容に問題があります", {
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const { message, jobId, missingInfo } = parsed.data;

    const agent = await prisma.agentProfile.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });

    if (!agent) {
      throw new NotFoundError("エージェントが見つかりません");
    }

    if (agent.status !== "PUBLIC") {
      throw new ForbiddenError("このエージェントは公開されていません");
    }

    if (await isCompanyAccessDenied(session.user.companyId, agent.userId)) {
      throw new ForbiddenError("アクセスが拒否されています");
    }

    let job = null;
    if (jobId) {
      job = await prisma.jobPosting.findFirst({
        where: {
          id: jobId,
          recruiterId: session.user.recruiterId,
        },
      });

      if (!job) {
        throw new NotFoundError("求人が見つかりません");
      }
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
      if (!session.user.companyId) {
        throw new ForbiddenError("会社に所属していません");
      }

      try {
        // セッション作成とポイント消費をアトミックに実行
        const { result: newSession } = await consumePointsWithOperations(
          session.user.companyId,
          "CONVERSATION",
          async (tx) => {
            // サブスクリプション行ロック取得後に再チェック
            // 同時リクエストで既にセッションが作成済みならロールバック
            const existing = await tx.session.findFirst({
              where: {
                recruiterId: session.user.recruiterId,
                agentId: id,
                sessionType: "RECRUITER_AGENT_CHAT",
              },
            });
            if (existing) {
              throw new DuplicateSessionError();
            }

            return tx.session.create({
              data: {
                sessionType: "RECRUITER_AGENT_CHAT",
                recruiterId: session.user.recruiterId,
                agentId: id,
              },
              include: {
                messages: true,
              },
            });
          },
          undefined,
          `エージェント会話: ${agent.user.name}`,
        );
        chatSession = newSession;
      } catch (error) {
        if (error instanceof DuplicateSessionError) {
          // 同時リクエストによりセッションが既に作成されていた — 再取得
          logger.warn("Duplicate session creation prevented", {
            recruiterId: session.user.recruiterId,
            agentId: id,
          });
          chatSession = await prisma.session.findFirst({
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
        } else {
          throw error;
        }
      }
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
      select: {
        id: true,
        type: true,
        content: true,
        skills: true,
        keywords: true,
      },
    });

    // 質問に関連するフラグメントをスコアリング
    const messageLower = message.toLowerCase();
    const scoredFragments = fragments.map((f) => {
      let score = 0;
      const contentLower = f.content.toLowerCase();

      // キーワードマッチング
      for (const skill of f.skills) {
        if (messageLower.includes(skill.toLowerCase())) {
          score += 3;
        }
      }
      for (const keyword of f.keywords) {
        if (messageLower.includes(keyword.toLowerCase())) {
          score += 2;
        }
      }

      // 内容に含まれる一般的なキーワード
      const messageWords = messageLower.split(/\s+/);
      for (const word of messageWords) {
        if (word.length > 2 && contentLower.includes(word)) {
          score += 1;
        }
      }

      return { fragment: f, score };
    });

    // スコアが高い順にソートし、上位のフラグメントを選択
    const relevantFragments = scoredFragments
      .filter((sf) => sf.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((sf) => sf.fragment);

    const coverage = calculateCoverage(fragments);

    const fragmentsContext = fragments
      .map((f, i) => `[REF${i + 1}] [${f.type}]: ${f.content}`)
      .join("\n");

    const fulfilledCategories = coverage.categories
      .filter((c) => c.fulfilled)
      .map((c) => `- ${c.label} ✓`)
      .join("\n");
    const missingCategories = coverage.categories
      .filter((c) => !c.fulfilled)
      .map((c) => `- ${c.label}（${c.current}/${c.required}件）`)
      .join("\n");

    const jobContext = job
      ? `\nこの面接は以下の求人に関するものです。\n求人タイトル: ${job.title}\n業務内容: ${job.description}\n必須スキル: ${job.skills.join(", ") || "なし"}\n経験レベル: ${job.experienceLevel}\n`
      : "";

    const enhancedSystemPrompt = `${agent.systemPrompt}

以下は${agent.user.name}さんに関する情報です。この情報を参考にして回答してください：

${fragmentsContext || "（詳細な情報はまだ収集されていません）"}

## 情報カバレッジ（${coverage.percentage}%）
### 収集済みカテゴリ
${fulfilledCategories || "なし"}
### 不足カテゴリ
${missingCategories || "なし"}

## 応答ルール
- 採用担当者からの質問に対して、${agent.user.name}さんの代理として丁寧かつ専門的に回答してください。
- 情報の充足度について聞かれた場合は、上記のカバレッジ情報（${coverage.percentage}%）を正確に参照してください。自分で別の数値を推測しないでください。
- 持っている情報で答えられる質問には具体的に答えてください。
- わからないことは正直に「その点についてはまだ情報を持っていません」と答えてください。`;

    const fullSystemPrompt = `${enhancedSystemPrompt}${jobContext}`;

    const responseMessage = await generateChatResponse(fullSystemPrompt, [
      ...previousMessages,
      { role: "user", content: message },
    ]);

    const aiMessage = await prisma.message.create({
      data: {
        sessionId: chatSession.id,
        senderType: "AI",
        content: responseMessage,
      },
    });

    // 関連するフラグメントへの参照を保存
    if (relevantFragments.length > 0) {
      await prisma.messageReference.createMany({
        data: relevantFragments.map((f) => ({
          messageId: aiMessage.id,
          refType: "FRAGMENT" as const,
          refId: f.id,
        })),
      });
    }

    // 参照情報を返す
    const references = relevantFragments.map((f) => ({
      id: f.id,
      type: f.type,
      content:
        f.content.length > 100
          ? `${f.content.substring(0, 100)}...`
          : f.content,
      skills: f.skills,
    }));

    let followUps: string[] = [];
    if (job) {
      try {
        const info = Array.isArray(missingInfo) ? missingInfo : [];
        followUps = await generateFollowUpQuestions({
          job: {
            title: job.title,
            description: job.description,
            skills: job.skills,
            experienceLevel: job.experienceLevel,
          },
          question: message,
          answer: responseMessage,
          missingInfo: info,
        });
      } catch (_followError) {
        // フォローアップ質問の生成失敗は無視（メイン機能ではない）
      }
    }

    return NextResponse.json({
      message: responseMessage,
      references,
      followUps,
    });
  },
);
