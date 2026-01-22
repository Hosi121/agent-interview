import type { ExperienceLevel } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ウォッチリスト一覧取得
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.recruiterId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
  } catch (error) {
    console.error("Get watches error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ウォッチリスト作成
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.recruiterId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      jobId,
      skills,
      keywords,
      experienceLevel,
      locationPref,
      salaryMin,
    } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
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

    const watch = await prisma.candidateWatch.create({
      data: {
        recruiterId: session.user.recruiterId,
        name,
        jobId,
        skills: skills || [],
        keywords: keywords || [],
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
  } catch (error) {
    console.error("Create watch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// 既存エージェントとのマッチング確認
async function checkExistingAgentsForWatch(watchId: string) {
  const watch = await prisma.candidateWatch.findUnique({
    where: { id: watchId },
  });

  if (!watch || !watch.isActive) return;

  const agents = await prisma.agentProfile.findMany({
    where: {
      status: "PUBLIC",
      user: {
        companyAccesses: {
          none: {
            recruiterId: watch.recruiterId,
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
