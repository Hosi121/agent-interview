import type { PipelineStage } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isCompanyAccessDenied } from "@/lib/access-control";
import { withRecruiterAuth } from "@/lib/api-utils";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

const _VALID_STAGES: PipelineStage[] = [
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
export const GET = withRecruiterAuth<RouteContext>(
  async (req, session, context) => {
    const { id } = await context.params;

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
      throw new NotFoundError("パイプラインが見つかりません");
    }

    if (
      await isCompanyAccessDenied(session.user.companyId, pipeline.agent.userId)
    ) {
      throw new ForbiddenError("アクセスが拒否されています");
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
  },
);

const updatePipelineSchema = z.object({
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

// パイプラインステージ更新
export const PATCH = withRecruiterAuth<RouteContext>(
  async (req, session, context) => {
    const { id } = await context.params;
    const rawBody = await req.json();
    const parsed = updatePipelineSchema.safeParse(rawBody);

    if (!parsed.success) {
      throw new ValidationError("入力内容に問題があります", {
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const { stage, note } = parsed.data;

    const updateData: { stage?: PipelineStage; note?: string } = {};
    if (stage) updateData.stage = stage;
    if (note !== undefined) updateData.note = note;

    // トランザクション内で取得・検証・更新を原子的に実行（TOCTOU防止）
    const pipeline = await prisma.$transaction(async (tx) => {
      const existingPipeline = await tx.candidatePipeline.findFirst({
        where: {
          id,
          recruiterId: session.user.recruiterId,
        },
        include: {
          agent: {
            select: { userId: true },
          },
        },
      });

      if (!existingPipeline) {
        throw new NotFoundError("パイプラインが見つかりません");
      }

      // アクセス拒否チェック
      const accessDenied = await tx.companyAccess.findUnique({
        where: {
          userId_companyId: {
            userId: existingPipeline.agent.userId,
            companyId: session.user.companyId,
          },
        },
        select: { status: true },
      });
      if (accessDenied?.status === "DENY") {
        throw new ForbiddenError("アクセスが拒否されています");
      }

      // ステージ変更があれば履歴に記録（トランザクション内で最新のstageを参照）
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
  },
);

// パイプラインから削除
export const DELETE = withRecruiterAuth<RouteContext>(
  async (req, session, context) => {
    const { id } = await context.params;

    // トランザクション内で取得・検証・削除を原子的に実行（TOCTOU防止）
    await prisma.$transaction(async (tx) => {
      const existingPipeline = await tx.candidatePipeline.findFirst({
        where: {
          id,
          recruiterId: session.user.recruiterId,
        },
        include: {
          agent: {
            select: { userId: true },
          },
        },
      });

      if (!existingPipeline) {
        throw new NotFoundError("パイプラインが見つかりません");
      }

      // アクセス拒否チェック
      const accessDenied = await tx.companyAccess.findUnique({
        where: {
          userId_companyId: {
            userId: existingPipeline.agent.userId,
            companyId: session.user.companyId,
          },
        },
        select: { status: true },
      });
      if (accessDenied?.status === "DENY") {
        throw new ForbiddenError("アクセスが拒否されています");
      }

      await tx.candidatePipeline.delete({
        where: { id },
      });
    });

    return NextResponse.json({ success: true });
  },
);
