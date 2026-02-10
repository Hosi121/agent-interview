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
      return NextResponse.json({ notes: [] });
    }

    const notes = await prisma.interviewNote.findMany({
      where: {
        sessionId: chatSession.id,
        recruiterId: session.user.recruiterId,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ notes });
  },
);

const noteSchema = z.object({
  content: z.string().min(1, "メモの内容を入力してください"),
});

export const POST = withRecruiterAuth<RouteContext>(
  async (req, session, context) => {
    const { id: agentId } = await context.params;
    const rawBody = await req.json();
    const parsed = noteSchema.safeParse(rawBody);

    if (!parsed.success) {
      throw new ValidationError("入力内容に問題があります", {
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const { content } = parsed.data;

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
      throw new NotFoundError("まず面接チャットを開始してください");
    }

    const note = await prisma.interviewNote.create({
      data: {
        sessionId: chatSession.id,
        recruiterId: session.user.recruiterId,
        content: content.trim(),
      },
    });

    return NextResponse.json({ note }, { status: 201 });
  },
);
