import { NextResponse } from "next/server";
import { z } from "zod";
import { isCompanyAccessDenied } from "@/lib/access-control";
import { withRecruiterAuth } from "@/lib/api-utils";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
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
    });

    if (!interviewSession) {
      throw new NotFoundError("まず面接チャットを開始してください");
    }

    const evaluation = await prisma.interviewEvaluation.upsert({
      where: { sessionId: interviewSession.id },
      update: {
        overallRating,
        technicalRating,
        communicationRating,
        cultureRating,
        comment: comment || null,
      },
      create: {
        sessionId: interviewSession.id,
        recruiterId: session.user.recruiterId,
        overallRating,
        technicalRating,
        communicationRating,
        cultureRating,
        comment: comment || null,
      },
    });

    return NextResponse.json({ evaluation });
  },
);
