import type { PipelineStage } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isCompanyAccessDenied } from "@/lib/access-control";
import { withRecruiterAuth } from "@/lib/api-utils";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
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
export const GET = withRecruiterAuth(async (req, session) => {
  const searchParams = req.nextUrl.searchParams;
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
              companyId: session.user.companyId,
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
    take: 200,
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
});

const addToPipelineSchema = z.object({
  agentId: z.string().min(1, "agentId is required"),
  jobId: z.string().optional(),
  stage: z
    .enum([
      "INTERESTED",
      "CONTACTED",
      "SCREENING",
      "INTERVIEWING",
      "OFFER",
      "HIRED",
      "REJECTED",
      "WITHDRAWN",
    ])
    .optional(),
  note: z.string().max(5000).optional(),
});

// パイプラインに候補者追加
export const POST = withRecruiterAuth(async (req, session) => {
  const rawBody = await req.json();
  const parsed = addToPipelineSchema.safeParse(rawBody);

  if (!parsed.success) {
    throw new ValidationError("入力内容に問題があります", {
      fields: parsed.error.flatten().fieldErrors,
    });
  }

  const { agentId, jobId, stage, note } = parsed.data;

  const agent = await prisma.agentProfile.findFirst({
    where: {
      id: agentId,
      status: "PUBLIC",
    },
  });

  if (!agent) {
    throw new NotFoundError("エージェントが見つからないか、非公開です");
  }

  if (await isCompanyAccessDenied(session.user.companyId, agent.userId)) {
    throw new ForbiddenError("アクセスが拒否されています");
  }

  if (jobId) {
    const job = await prisma.jobPosting.findFirst({
      where: {
        id: jobId,
        recruiterId: session.user.recruiterId,
      },
    });
    if (!job) {
      throw new NotFoundError("求人が見つかりません");
    }
  }

  const initialStage: PipelineStage = stage || "INTERESTED";

  // トランザクション内で重複チェックと作成を原子的に実行（TOCTOU防止）
  // PostgreSQLではNULL値はユニーク制約で等価比較されないため、
  // jobId=nullの場合はトランザクション内チェックが必須
  try {
    const pipeline = await prisma.$transaction(async (tx) => {
      const existingPipeline = await tx.candidatePipeline.findFirst({
        where: {
          recruiterId: session.user.recruiterId,
          agentId,
          jobId: jobId || null,
        },
      });

      if (existingPipeline) {
        throw new ConflictError(
          "この候補者は既にパイプラインに追加されています",
        );
      }

      return tx.candidatePipeline.create({
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
    });

    return NextResponse.json({ pipeline }, { status: 201 });
  } catch (error) {
    // jobIdがnon-nullの場合、ユニーク制約違反で重複を検出
    const prismaError = error as { code?: string };
    if (prismaError.code === "P2002") {
      throw new ConflictError("この候補者は既にパイプラインに追加されています");
    }
    throw error;
  }
});
