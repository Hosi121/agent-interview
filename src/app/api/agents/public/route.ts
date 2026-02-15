import { NextResponse } from "next/server";
import { withRecruiterAuth } from "@/lib/api-utils";
import { NotFoundError } from "@/lib/errors";
import { calculateJobMatchScore } from "@/lib/matching";
import { prisma } from "@/lib/prisma";

export const GET = withRecruiterAuth(async (request, session) => {
  const searchParams = request.nextUrl.searchParams;
  const jobId = searchParams.get("jobId");

  const agents = await prisma.agentProfile.findMany({
    where: {
      status: "PUBLIC",
      user: {
        companyAccesses: {
          none: {
            companyId: session.user.companyId,
            status: "DENY",
          },
        },
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          avatarPath: true,
          fragments: {
            select: {
              id: true,
              type: true,
              skills: true,
              keywords: true,
              content: true,
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // 求人フィルタがある場合
  if (jobId) {
    const job = await prisma.jobPosting.findFirst({
      where: { id: jobId, recruiterId: session.user.recruiterId },
    });

    if (!job) {
      throw new NotFoundError("求人が見つかりません");
    }

    // 各エージェントのマッチスコアを計算
    const agentsWithScores = agents.map((agent) => {
      const allSkills = new Set<string>();
      const allKeywords = new Set<string>();

      for (const fragment of agent.user.fragments) {
        for (const skill of fragment.skills) allSkills.add(skill);
        for (const keyword of fragment.keywords) allKeywords.add(keyword);
      }

      const scoreDetails = calculateJobMatchScore(
        {
          skills: job.skills,
          keywords: job.keywords,
          experienceLevel: job.experienceLevel,
        },
        {
          skills: Array.from(allSkills),
          keywords: Array.from(allKeywords),
          fragments: agent.user.fragments,
        },
      );

      // マッチの理由を生成
      const matchReasons: string[] = [];
      const matchedSkills = Array.from(allSkills).filter((s) =>
        job.skills.some((js) => js.toLowerCase() === s.toLowerCase()),
      );
      const matchedKeywords = Array.from(allKeywords).filter((k) =>
        job.keywords.some((jk) => jk.toLowerCase() === k.toLowerCase()),
      );

      if (matchedSkills.length > 0) {
        matchReasons.push(
          `スキル一致: ${matchedSkills.slice(0, 3).join(", ")}`,
        );
      }
      if (matchedKeywords.length > 0) {
        matchReasons.push(
          `キーワード一致: ${matchedKeywords.slice(0, 3).join(", ")}`,
        );
      }

      return {
        ...agent,
        user: {
          id: agent.user.id,
          name: agent.user.name,
          avatarPath: agent.user.avatarPath,
        },
        skills: Array.from(allSkills).slice(0, 10),
        matchScore: scoreDetails.totalScore,
        matchReasons,
      };
    });

    // スコアでソート
    agentsWithScores.sort((a, b) => b.matchScore - a.matchScore);

    return NextResponse.json({ agents: agentsWithScores, jobId });
  }

  // 求人フィルタなしの場合（通常表示）
  const agentsWithSkills = agents.map((agent) => {
    const allSkills = new Set<string>();
    for (const fragment of agent.user.fragments) {
      for (const skill of fragment.skills) allSkills.add(skill);
    }

    return {
      ...agent,
      user: {
        id: agent.user.id,
        name: agent.user.name,
        avatarPath: agent.user.avatarPath,
      },
      skills: Array.from(allSkills).slice(0, 10),
      matchScore: null,
      matchReasons: [],
    };
  });

  return NextResponse.json({ agents: agentsWithSkills });
});
