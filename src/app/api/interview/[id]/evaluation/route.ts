import { NextResponse } from "next/server";
import { z } from "zod";
import { isCompanyAccessDenied } from "@/lib/access-control";
import { withRecruiterAuth } from "@/lib/api-utils";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { openai } from "@/lib/openai";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withRecruiterAuth<RouteContext>(
  async (req, session, context) => {
    const { id: agentId } = await context.params;

    const agent = await prisma.agentProfile.findUnique({
      where: { id: agentId },
      select: { userId: true, status: true },
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

    // agentIdからセッションを検索
    const chatSession = await prisma.session.findFirst({
      where: {
        agentId,
        recruiterId: session.user.recruiterId,
        sessionType: "RECRUITER_AGENT_CHAT",
      },
    });

    if (!chatSession) {
      return NextResponse.json({ evaluation: null });
    }

    const evaluation = await prisma.interviewEvaluation.findUnique({
      where: { sessionId: chatSession.id },
    });

    return NextResponse.json({ evaluation });
  },
);

const evaluationSchema = z.object({
  overallRating: z.number().int().min(1).max(5),
  technicalRating: z.number().int().min(1).max(5),
  communicationRating: z.number().int().min(1).max(5),
  cultureRating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

export const POST = withRecruiterAuth<RouteContext>(
  async (req, session, context) => {
    const { id: agentId } = await context.params;
    const rawBody = await req.json();
    const parsed = evaluationSchema.safeParse(rawBody);

    if (!parsed.success) {
      throw new ValidationError("すべての評価項目を入力してください", {
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const {
      overallRating,
      technicalRating,
      communicationRating,
      cultureRating,
      comment,
    } = parsed.data;

    const agent = await prisma.agentProfile.findUnique({
      where: { id: agentId },
      select: { userId: true, status: true },
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

    // agentIdからセッションを検索
    const interviewSession = await prisma.session.findFirst({
      where: {
        agentId,
        recruiterId: session.user.recruiterId,
        sessionType: "RECRUITER_AGENT_CHAT",
      },
      include: {
        messages: true,
        agent: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!interviewSession) {
      throw new NotFoundError("まず面接チャットを開始してください");
    }

    let matchScore: number | null = null;

    if (interviewSession.agent && interviewSession.messages.length > 0) {
      try {
        const conversationSummary = interviewSession.messages
          .map((m) => `${m.senderType}: ${m.content}`)
          .join("\n");

        const fragments = await prisma.fragment.findMany({
          where: { userId: interviewSession.agent.userId },
        });

        const fragmentsSummary = fragments
          .map((f) => `[${f.type}]: ${f.content}`)
          .join("\n");

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `あなたは採用のマッチング評価を行うアシスタントです。
面接の会話内容と候補者のプロフィール情報を分析し、マッチ度を0-100のスコアで評価してください。
JSONで{"score": 数値, "reason": "理由"}の形式で回答してください。`,
            },
            {
              role: "user",
              content: `面接会話:\n${conversationSummary}\n\n候補者情報:\n${fragmentsSummary}`,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
        });

        const result = JSON.parse(
          response.choices[0]?.message?.content || "{}",
        );
        matchScore = result.score || null;
      } catch {
        // マッチスコア計算の失敗は無視（メイン機能ではない）
      }
    }

    const evaluation = await prisma.interviewEvaluation.upsert({
      where: { sessionId: interviewSession.id },
      update: {
        overallRating,
        technicalRating,
        communicationRating,
        cultureRating,
        matchScore,
        comment: comment || null,
      },
      create: {
        sessionId: interviewSession.id,
        recruiterId: session.user.recruiterId,
        overallRating,
        technicalRating,
        communicationRating,
        cultureRating,
        matchScore,
        comment: comment || null,
      },
    });

    return NextResponse.json({ evaluation });
  },
);
