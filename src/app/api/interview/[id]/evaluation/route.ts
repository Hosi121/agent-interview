import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isCompanyAccessDenied } from "@/lib/access-control";
import { openai } from "@/lib/openai";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.recruiterId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: agentId } = await params;

    const agent = await prisma.agentProfile.findUnique({
      where: { id: agentId },
      select: { userId: true, status: true },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (agent.status !== "PUBLIC") {
      return NextResponse.json(
        { error: "Agent is not public" },
        { status: 403 },
      );
    }

    if (await isCompanyAccessDenied(session.user.recruiterId, agent.userId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
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
  } catch (error) {
    console.error("Get evaluation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.recruiterId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: agentId } = await params;
    const body = await req.json();
    const {
      overallRating,
      technicalRating,
      communicationRating,
      cultureRating,
      comment,
    } = body;

    if (
      !overallRating ||
      !technicalRating ||
      !communicationRating ||
      !cultureRating
    ) {
      return NextResponse.json(
        { error: "すべての評価項目を入力してください" },
        { status: 400 },
      );
    }

    const agent = await prisma.agentProfile.findUnique({
      where: { id: agentId },
      select: { userId: true, status: true },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (agent.status !== "PUBLIC") {
      return NextResponse.json(
        { error: "Agent is not public" },
        { status: 403 },
      );
    }

    if (await isCompanyAccessDenied(session.user.recruiterId, agent.userId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
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
      return NextResponse.json(
        { error: "まず面接チャットを開始してください" },
        { status: 404 },
      );
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
      } catch (e) {
        console.error("Match score calculation error:", e);
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
  } catch (error) {
    console.error("Create evaluation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
