import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// スキルマッチング計算（Jaccard係数ベース）
function calculateSkillMatch(
  jobSkills: string[],
  candidateSkills: string[],
): number {
  if (jobSkills.length === 0) return 1.0;
  if (candidateSkills.length === 0) return 0;

  const jobSet = new Set(jobSkills.map((s) => s.toLowerCase()));
  const candidateSet = new Set(candidateSkills.map((s) => s.toLowerCase()));

  let matchCount = 0;
  for (const skill of jobSet) {
    for (const cSkill of candidateSet) {
      if (cSkill.includes(skill) || skill.includes(cSkill)) {
        matchCount++;
        break;
      }
    }
  }

  return matchCount / jobSet.size;
}

// キーワードマッチング計算
function calculateKeywordMatch(
  jobKeywords: string[],
  candidateKeywords: string[],
): number {
  if (jobKeywords.length === 0) return 1.0;
  if (candidateKeywords.length === 0) return 0;

  const jobSet = new Set(jobKeywords.map((k) => k.toLowerCase()));
  const candidateSet = new Set(candidateKeywords.map((k) => k.toLowerCase()));

  let matchCount = 0;
  for (const keyword of jobSet) {
    for (const cKeyword of candidateSet) {
      if (cKeyword.includes(keyword) || keyword.includes(cKeyword)) {
        matchCount++;
        break;
      }
    }
  }

  return matchCount / jobSet.size;
}

// 経験レベルマッチング
function calculateExperienceMatch(
  jobLevel: string,
  candidateFragments: { type: string }[],
): number {
  const workFragments = candidateFragments.filter(
    (f) =>
      f.type === "FACT" || f.type === "SKILL_USAGE" || f.type === "ACHIEVEMENT",
  );

  const experienceIndicators = workFragments.length;

  const levelMap: Record<string, number> = {
    ENTRY: 0,
    JUNIOR: 1,
    MID: 2,
    SENIOR: 3,
    LEAD: 4,
  };

  let estimatedLevel = 0;
  if (experienceIndicators >= 15) estimatedLevel = 4;
  else if (experienceIndicators >= 10) estimatedLevel = 3;
  else if (experienceIndicators >= 6) estimatedLevel = 2;
  else if (experienceIndicators >= 3) estimatedLevel = 1;

  const jobLevelNum = levelMap[jobLevel] ?? 2;

  const diff = Math.abs(estimatedLevel - jobLevelNum);
  if (diff === 0) return 1.0;
  if (diff === 1) return 0.7;
  if (diff === 2) return 0.4;
  return 0.2;
}

// マッチング実行
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.recruiterId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: jobId } = await params;

    const job = await prisma.jobPosting.findFirst({
      where: {
        id: jobId,
        recruiterId: session.user.recruiterId,
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const agents = await prisma.agentProfile.findMany({
      where: {
        status: "PUBLIC",
        user: {
          companyAccesses: {
            none: {
              recruiterId: session.user.recruiterId,
              status: "DENY",
            },
          },
        },
      },
      include: {
        user: {
          include: {
            fragments: {
              select: {
                type: true,
                skills: true,
                keywords: true,
              },
            },
          },
        },
      },
    });

    const matchResults = agents.map((agent) => {
      const fragments = agent.user.fragments;

      const candidateSkills = [...new Set(fragments.flatMap((f) => f.skills))];
      const candidateKeywords = [
        ...new Set(fragments.flatMap((f) => f.keywords)),
      ];

      const skillScore = calculateSkillMatch(job.skills, candidateSkills);
      const keywordScore = calculateKeywordMatch(
        job.keywords,
        candidateKeywords,
      );
      const experienceScore = calculateExperienceMatch(
        job.experienceLevel,
        fragments,
      );

      const totalScore =
        skillScore * 0.45 + keywordScore * 0.35 + experienceScore * 0.2;

      return {
        agentId: agent.id,
        score: Math.round(totalScore * 100) / 100,
        scoreDetails: {
          skill: Math.round(skillScore * 100) / 100,
          keyword: Math.round(keywordScore * 100) / 100,
          experience: Math.round(experienceScore * 100) / 100,
        },
      };
    });

    await Promise.all(
      matchResults.map((result) =>
        prisma.candidateMatch.upsert({
          where: {
            jobId_agentId: {
              jobId,
              agentId: result.agentId,
            },
          },
          create: {
            jobId,
            agentId: result.agentId,
            score: result.score,
            scoreDetails: result.scoreDetails,
          },
          update: {
            score: result.score,
            scoreDetails: result.scoreDetails,
            calculatedAt: new Date(),
          },
        }),
      ),
    );

    const topCandidates = await prisma.candidateMatch.findMany({
      where: {
        jobId,
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
                  select: { type: true, skills: true },
                  take: 10,
                },
              },
            },
          },
        },
      },
      orderBy: { score: "desc" },
      take: 50,
    });

    return NextResponse.json({
      totalMatched: matchResults.length,
      candidates: topCandidates,
    });
  } catch (error) {
    console.error("Match calculation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// マッチ済み候補者一覧取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.recruiterId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: jobId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const minScore = Number.parseFloat(searchParams.get("minScore") || "0");

    const job = await prisma.jobPosting.findFirst({
      where: {
        id: jobId,
        recruiterId: session.user.recruiterId,
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const candidates = await prisma.candidateMatch.findMany({
      where: {
        jobId,
        score: { gte: minScore },
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
                  select: { type: true, content: true, skills: true },
                  take: 5,
                },
              },
            },
          },
        },
      },
      orderBy: { score: "desc" },
    });

    return NextResponse.json({ candidates });
  } catch (error) {
    console.error("Get candidates error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
