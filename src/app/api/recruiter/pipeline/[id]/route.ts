import type { PipelineStage } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_STAGES: PipelineStage[] = [
  "INTERESTED",
  "CONTACTED",
  "SCREENING",
  "INTERVIEWING",
  "OFFER",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
];

// パイプライン詳細取得
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.recruiterId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const pipeline = await prisma.candidatePipeline.findFirst({
      where: {
        id,
        recruiterId: session.user.recruiterId,
      },
      include: {
        agent: {
          include: {
            user: {
              select: {
                name: true,
                fragments: true,
              },
            },
          },
        },
        job: true,
        history: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!pipeline) {
      return NextResponse.json(
        { error: "Pipeline not found" },
        { status: 404 },
      );
    }

    // 関連する面接セッションも取得
    const sessions = await prisma.session.findMany({
      where: {
        recruiterId: session.user.recruiterId,
        agentId: pipeline.agentId,
        sessionType: "RECRUITER_AGENT_CHAT",
      },
      include: {
        notes: true,
        evaluation: true,
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      pipeline,
      sessions,
    });
  } catch (error) {
    console.error("Get pipeline error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// パイプラインステージ更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.recruiterId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { stage, note } = body;

    const existingPipeline = await prisma.candidatePipeline.findFirst({
      where: {
        id,
        recruiterId: session.user.recruiterId,
      },
    });

    if (!existingPipeline) {
      return NextResponse.json(
        { error: "Pipeline not found" },
        { status: 404 },
      );
    }

    if (stage && !VALID_STAGES.includes(stage)) {
      return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
    }

    const updateData: { stage?: PipelineStage; note?: string } = {};
    if (stage) updateData.stage = stage;
    if (note !== undefined) updateData.note = note;

    // ステージ変更があれば履歴に記録
    const pipeline = await prisma.$transaction(async (tx) => {
      if (stage && stage !== existingPipeline.stage) {
        await tx.pipelineHistory.create({
          data: {
            pipelineId: id,
            fromStage: existingPipeline.stage,
            toStage: stage,
            note: note || undefined,
          },
        });
      }

      return tx.candidatePipeline.update({
        where: { id },
        data: updateData,
        include: {
          agent: {
            include: {
              user: {
                select: { name: true },
              },
            },
          },
          job: {
            select: { id: true, title: true },
          },
          history: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
      });
    });

    return NextResponse.json({ pipeline });
  } catch (error) {
    console.error("Update pipeline error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// パイプラインから削除
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.recruiterId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existingPipeline = await prisma.candidatePipeline.findFirst({
      where: {
        id,
        recruiterId: session.user.recruiterId,
      },
    });

    if (!existingPipeline) {
      return NextResponse.json(
        { error: "Pipeline not found" },
        { status: 404 },
      );
    }

    await prisma.candidatePipeline.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete pipeline error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
