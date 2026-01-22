import type { PipelineStage } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isCompanyAccessDenied } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

const PIPELINE_STAGES: PipelineStage[] = [
  "INTERESTED",
  "CONTACTED",
  "SCREENING",
  "INTERVIEWING",
  "OFFER",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
];

// パイプライン一覧取得（ステージ別にグループ化）
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.recruiterId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get("jobId");
    const stage = searchParams.get("stage") as PipelineStage | null;

    const pipelines = await prisma.candidatePipeline.findMany({
      where: {
        recruiterId: session.user.recruiterId,
        ...(jobId && { jobId }),
        ...(stage && { stage }),
        agent: {
          user: {
            companyAccesses: {
              none: {
                recruiterId: session.user.recruiterId,
                status: "DENY",
              },
            },
          },
        },
      },
      include: {
        agent: {
          include: {
            user: {
              select: {
                name: true,
                fragments: {
                  select: { type: true, skills: true, content: true },
                  take: 5,
                },
              },
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
      orderBy: { updatedAt: "desc" },
    });

    // ステージ別にグループ化
    const grouped = PIPELINE_STAGES.reduce(
      (acc, stg) => {
        acc[stg] = pipelines.filter((p) => p.stage === stg);
        return acc;
      },
      {} as Record<PipelineStage, typeof pipelines>,
    );

    return NextResponse.json({
      pipelines,
      grouped,
      counts: PIPELINE_STAGES.reduce(
        (acc, stg) => {
          acc[stg] = grouped[stg].length;
          return acc;
        },
        {} as Record<PipelineStage, number>,
      ),
    });
  } catch (error) {
    console.error("Get pipeline error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// パイプラインに候補者追加
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.recruiterId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { agentId, jobId, stage, note } = body;

    if (!agentId) {
      return NextResponse.json(
        { error: "agentId is required" },
        { status: 400 },
      );
    }

    const agent = await prisma.agentProfile.findFirst({
      where: {
        id: agentId,
        status: "PUBLIC",
      },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found or not public" },
        { status: 404 },
      );
    }

    if (await isCompanyAccessDenied(session.user.recruiterId, agent.userId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (jobId) {
      const job = await prisma.jobPosting.findFirst({
        where: {
          id: jobId,
          recruiterId: session.user.recruiterId,
        },
      });
      if (!job) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
      }
    }

    const existingPipeline = await prisma.candidatePipeline.findFirst({
      where: {
        recruiterId: session.user.recruiterId,
        agentId,
        jobId: jobId || null,
      },
    });

    if (existingPipeline) {
      return NextResponse.json(
        { error: "Candidate already in pipeline", pipeline: existingPipeline },
        { status: 409 },
      );
    }

    const initialStage: PipelineStage = stage || "INTERESTED";

    const pipeline = await prisma.candidatePipeline.create({
      data: {
        recruiterId: session.user.recruiterId,
        agentId,
        jobId,
        stage: initialStage,
        note,
        history: {
          create: {
            toStage: initialStage,
            note: "パイプラインに追加",
          },
        },
      },
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
      },
    });

    return NextResponse.json({ pipeline }, { status: 201 });
  } catch (error) {
    console.error("Add to pipeline error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
