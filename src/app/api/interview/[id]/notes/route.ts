import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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
  } catch (error) {
    console.error("Get notes error:", error);
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
    const { content } = await req.json();

    if (!content?.trim()) {
      return NextResponse.json(
        { error: "メモの内容を入力してください" },
        { status: 400 },
      );
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
      return NextResponse.json(
        { error: "まず面接チャットを開始してください" },
        { status: 404 },
      );
    }

    const note = await prisma.interviewNote.create({
      data: {
        sessionId: chatSession.id,
        recruiterId: session.user.recruiterId,
        content: content.trim(),
      },
    });

    return NextResponse.json({ note });
  } catch (error) {
    console.error("Create note error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
