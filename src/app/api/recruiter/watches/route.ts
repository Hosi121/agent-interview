import type { ExperienceLevel } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withRecruiterAuth } from "@/lib/api-utils";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

// ウォッチリスト一覧取得
export const GET = withRecruiterAuth(async (req, session) => {
  const watches = await prisma.candidateWatch.findMany({
    where: {
      recruiterId: session.user.recruiterId,
    },
    include: {
      job: {
        select: { id: true, title: true },
      },
      _count: {
        select: { notifications: true },
      },
      notifications: {
        where: { isRead: false },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const watchesWithUnread = watches.map((watch) => ({
    ...watch,
    unreadCount: watch.notifications.length,
    notifications: undefined,
  }));

  return NextResponse.json({ watches: watchesWithUnread });
});

const createWatchSchema = z.object({
  name: z.string().min(1, "名前は必須です"),
  jobId: z.string().optional(),
  skills: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  experienceLevel: z.enum(["JUNIOR", "MID", "SENIOR", "LEAD"]).optional(),
  locationPref: z.string().optional(),
  salaryMin: z.number().optional(),
});

// ウォッチリスト作成
export const POST = withRecruiterAuth(async (req, session) => {
  const rawBody = await req.json();
  const parsed = createWatchSchema.safeParse(rawBody);

  if (!parsed.success) {
    throw new ValidationError("入力内容に問題があります", {
      fields: parsed.error.flatten().fieldErrors,
    });
  }

  const {
    name,
    jobId,
    skills,
    keywords,
    experienceLevel,
    locationPref,
    salaryMin,
  } = parsed.data;

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

  const watch = await prisma.candidateWatch.create({
    data: {
      recruiterId: session.user.recruiterId,
      name,
      jobId,
      skills,
      keywords,
      experienceLevel,
      locationPref,
      salaryMin,
    },
    include: {
      job: {
        select: { id: true, title: true },
      },
    },
  });

  // 既存の公開エージェントとマッチング確認
  await checkExistingAgentsForWatch(watch.id);

  return NextResponse.json({ watch }, { status: 201 });
});

// 既存エージェントとのマッチング確認
async function checkExistingAgentsForWatch(watchId: string) {
  const watch = await prisma.candidateWatch.findUnique({
    where: { id: watchId },
    include: {
      recruiter: {
        select: { companyId: true },
      },
    },
  });

  if (!watch || !watch.isActive) return;

  const agents = await prisma.agentProfile.findMany({
    where: {
      status: "PUBLIC",
      user: {
        companyAccesses: {
          none: {
            companyId: watch.recruiter.companyId,
            status: "DENY",
          },
        },
      },
    },
    include: {
      user: {
        include: {
          fragments: {
            select: { skills: true, keywords: true },
          },
        },
      },
    },
  });

  for (const agent of agents) {
    const score = calculateWatchMatchScore(watch, agent);
    if (score >= 0.5) {
      await prisma.watchNotification.upsert({
        where: {
          watchId_agentId: {
            watchId: watch.id,
            agentId: agent.id,
          },
        },
        create: {
          watchId: watch.id,
          agentId: agent.id,
          matchScore: score,
        },
        update: {
          matchScore: score,
        },
      });
    }
  }
}

// ウォッチ条件とエージェントのマッチスコア計算
function calculateWatchMatchScore(
  watch: {
    skills: string[];
    keywords: string[];
    experienceLevel: ExperienceLevel | null;
  },
  agent: {
    user: {
      fragments: {
        skills: string[];
        keywords: string[];
      }[];
    };
  },
): number {
  const candidateSkills = [
    ...new Set(agent.user.fragments.flatMap((f) => f.skills)),
  ];
  const candidateKeywords = [
    ...new Set(agent.user.fragments.flatMap((f) => f.keywords)),
  ];

  let score = 0;
  let weight = 0;

  if (watch.skills.length > 0) {
    const watchSkillsLower = watch.skills.map((s) => s.toLowerCase());
    const candidateSkillsLower = candidateSkills.map((s) => s.toLowerCase());
    let matchCount = 0;
    for (const skill of watchSkillsLower) {
      if (
        candidateSkillsLower.some(
          (cs) => cs.includes(skill) || skill.includes(cs),
        )
      ) {
        matchCount++;
      }
    }
    score += (matchCount / watch.skills.length) * 0.5;
    weight += 0.5;
  }

  if (watch.keywords.length > 0) {
    const watchKeywordsLower = watch.keywords.map((k) => k.toLowerCase());
    const candidateKeywordsLower = candidateKeywords.map((k) =>
      k.toLowerCase(),
    );
    let matchCount = 0;
    for (const keyword of watchKeywordsLower) {
      if (
        candidateKeywordsLower.some(
          (ck) => ck.includes(keyword) || keyword.includes(ck),
        )
      ) {
        matchCount++;
      }
    }
    score += (matchCount / watch.keywords.length) * 0.5;
    weight += 0.5;
  }

  if (weight === 0) return 0.5;
  return score / weight;
}
