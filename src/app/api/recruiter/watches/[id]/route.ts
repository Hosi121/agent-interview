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
  name: z.string().min(1).optional(),
  skills: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  experienceLevel: z
    .enum(["JUNIOR", "MID", "SENIOR", "LEAD"])
    .optional()
    .nullable(),
  locationPref: z.string().optional().nullable(),
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

    const watch = await prisma.candidateWatch.update({
      where: { id },
      data: body,
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

    await prisma.candidateWatch.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  },
);
