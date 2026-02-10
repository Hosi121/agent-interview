import type { JobStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withRecruiterAuth, withRecruiterValidation } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

// 求人一覧取得
export const GET = withRecruiterAuth(async (request, session) => {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status") as JobStatus | null;

  const jobs = await prisma.jobPosting.findMany({
    where: {
      recruiterId: session.user.recruiterId,
      ...(status && { status }),
    },
    include: {
      _count: {
        select: {
          matches: true,
          pipelines: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ jobs });
});

const jobPostingSchema = z.object({
  title: z.string().min(1, "タイトルは必須です"),
  description: z.string().min(1, "説明は必須です"),
  requirements: z.string().optional(),
  preferredSkills: z.string().optional(),
  skills: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  employmentType: z.enum(
    ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP", "FREELANCE"],
    {
      message:
        "雇用形態はFULL_TIME, PART_TIME, CONTRACT, INTERNSHIP, FREELANCEのいずれかを指定してください",
    },
  ),
  experienceLevel: z.enum(["ENTRY", "JUNIOR", "MID", "SENIOR", "LEAD"], {
    message:
      "経験レベルはENTRY, JUNIOR, MID, SENIOR, LEADのいずれかを指定してください",
  }),
  location: z.string().optional(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  isRemote: z.boolean().default(false),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "CLOSED"]).default("DRAFT"),
});

// 求人作成
export const POST = withRecruiterValidation(
  jobPostingSchema,
  async (body, req, session) => {
    const job = await prisma.jobPosting.create({
      data: {
        recruiterId: session.user.recruiterId,
        ...body,
      },
    });

    return NextResponse.json({ job }, { status: 201 });
  },
);
