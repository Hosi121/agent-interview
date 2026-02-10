import { NextResponse } from "next/server";
import { z } from "zod";
import { withRecruiterAuth } from "@/lib/api-utils";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

// 求人詳細取得
export const GET = withRecruiterAuth<RouteContext>(
  async (req, session, context) => {
    const { id } = await context.params;

    const job = await prisma.jobPosting.findFirst({
      where: {
        id,
        recruiterId: session.user.recruiterId,
      },
      include: {
        matches: {
          include: {
            agent: {
              include: {
                user: {
                  select: { name: true },
                },
              },
            },
          },
          orderBy: { score: "desc" },
          take: 20,
        },
        pipelines: {
          include: {
            agent: {
              include: {
                user: {
                  select: { name: true },
                },
              },
            },
          },
        },
        _count: {
          select: {
            matches: true,
            pipelines: true,
            watches: true,
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundError("求人が見つかりません");
    }

    return NextResponse.json({ job });
  },
);

const jobUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  requirements: z.string().optional().nullable(),
  preferredSkills: z.string().optional().nullable(),
  skills: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  employmentType: z
    .enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP", "FREELANCE"])
    .optional(),
  experienceLevel: z
    .enum(["ENTRY", "JUNIOR", "MID", "SENIOR", "LEAD"])
    .optional(),
  location: z.string().optional().nullable(),
  salaryMin: z.number().optional().nullable(),
  salaryMax: z.number().optional().nullable(),
  isRemote: z.boolean().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "CLOSED"]).optional(),
});

// 求人更新
export const PATCH = withRecruiterAuth<RouteContext>(
  async (req, session, context) => {
    const { id } = await context.params;
    const rawBody = await req.json();
    const parsed = jobUpdateSchema.safeParse(rawBody);

    if (!parsed.success) {
      throw new ValidationError("入力内容に問題があります", {
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const body = parsed.data;

    const existingJob = await prisma.jobPosting.findFirst({
      where: {
        id,
        recruiterId: session.user.recruiterId,
      },
    });

    if (!existingJob) {
      throw new NotFoundError("求人が見つかりません");
    }

    const job = await prisma.jobPosting.update({
      where: { id },
      data: body,
    });

    return NextResponse.json({ job });
  },
);

// 求人削除
export const DELETE = withRecruiterAuth<RouteContext>(
  async (req, session, context) => {
    const { id } = await context.params;

    const existingJob = await prisma.jobPosting.findFirst({
      where: {
        id,
        recruiterId: session.user.recruiterId,
      },
    });

    if (!existingJob) {
      throw new NotFoundError("求人が見つかりません");
    }

    await prisma.jobPosting.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  },
);
