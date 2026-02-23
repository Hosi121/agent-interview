import { NextResponse } from "next/server";
import { z } from "zod";
import { withRecruiterAuth } from "@/lib/api-utils";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

// ウォッチリスト詳細取得（通知一覧含む）
export const GET = withRecruiterAuth<RouteContext>(
  async (req, session, context) => {
    const { id } = await context.params;

    const watch = await prisma.candidateWatch.findFirst({
      where: {
        id,
        recruiterId: session.user.recruiterId,
      },
      include: {
        job: {
          select: { id: true, title: true },
        },
        notifications: {
          include: {
            agent: {
              include: {
                user: {
                  select: {
                    name: true,
                    fragments: {
                      select: { type: true, skills: true },
                      take: 5,
                    },
                  },
                },
              },
            },
          },
          orderBy: [
            { isRead: "asc" },
            { matchScore: "desc" },
            { createdAt: "desc" },
          ],
        },
      },
    });

    if (!watch) {
      throw new NotFoundError("ウォッチリストが見つかりません");
    }

    return NextResponse.json({ watch });
  },
);

const updateWatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  skills: z.array(z.string().max(200)).max(50).optional(),
  keywords: z.array(z.string().max(200)).max(50).optional(),
  experienceLevel: z
    .enum(["JUNIOR", "MID", "SENIOR", "LEAD"])
    .optional()
    .nullable(),
  locationPref: z.string().max(500).optional().nullable(),
  salaryMin: z.number().optional().nullable(),
  isActive: z.boolean().optional(),
});

// ウォッチリスト更新
export const PATCH = withRecruiterAuth<RouteContext>(
  async (req, session, context) => {
    const { id } = await context.params;
    const rawBody = await req.json();
    const parsed = updateWatchSchema.safeParse(rawBody);

    if (!parsed.success) {
      throw new ValidationError("入力内容に問題があります", {
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const body = parsed.data;

    const existingWatch = await prisma.candidateWatch.findFirst({
      where: {
        id,
        recruiterId: session.user.recruiterId,
      },
    });

    if (!existingWatch) {
      throw new NotFoundError("ウォッチリストが見つかりません");
    }

    // TOCTOU防止: recruiterId条件付きupdateManyで所有権を原子的に検証
    const result = await prisma.candidateWatch.updateMany({
      where: { id, recruiterId: session.user.recruiterId },
      data: body,
    });

    if (result.count === 0) {
      throw new NotFoundError("ウォッチリストの更新に失敗しました");
    }

    // 更新後のデータを返す
    const watch = await prisma.candidateWatch.findFirst({
      where: { id, recruiterId: session.user.recruiterId },
    });

    return NextResponse.json({ watch });
  },
);

// ウォッチリスト削除
export const DELETE = withRecruiterAuth<RouteContext>(
  async (req, session, context) => {
    const { id } = await context.params;

    const existingWatch = await prisma.candidateWatch.findFirst({
      where: {
        id,
        recruiterId: session.user.recruiterId,
      },
    });

    if (!existingWatch) {
      throw new NotFoundError("ウォッチリストが見つかりません");
    }

    // TOCTOU防止: recruiterId条件付きdeleteManyで所有権を原子的に検証
    const result = await prisma.candidateWatch.deleteMany({
      where: { id, recruiterId: session.user.recruiterId },
    });

    if (result.count === 0) {
      throw new NotFoundError("ウォッチリストの削除に失敗しました");
    }

    return NextResponse.json({ success: true });
  },
);
