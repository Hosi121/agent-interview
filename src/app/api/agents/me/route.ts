import type { AgentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withUserAuth } from "@/lib/api-utils";
import { ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  calculateJobMatchScore,
  calculateWatchMatchScore,
} from "@/lib/matching";
import { prisma } from "@/lib/prisma";

const MATCH_THRESHOLD = 0.3; // 30%以上でマッチとみなす

// エージェント公開時の自動マッチング処理
async function performAutoMatching(agentId: string, userId: string) {
  try {
    // エージェントのフラグメントを取得
    const fragments = await prisma.fragment.findMany({
      where: { userId },
      select: {
        skills: true,
        keywords: true,
      },
    });

    // スキルとキーワードを集約
    const allSkills = new Set<string>();
    const allKeywords = new Set<string>();
    for (const f of fragments) {
      for (const s of f.skills) allSkills.add(s);
      for (const k of f.keywords) allKeywords.add(k);
    }

    const agentProfile = {
      skills: Array.from(allSkills),
      keywords: Array.from(allKeywords),
    };

    // === ウォッチマッチング ===
    const activeWatches = await prisma.candidateWatch.findMany({
      where: { isActive: true },
    });

    const watchMatchResults: { watchId: string; score: number }[] = [];

    for (const watch of activeWatches) {
      const score = calculateWatchMatchScore(watch, agentProfile);

      if (score >= MATCH_THRESHOLD) {
        watchMatchResults.push({
          watchId: watch.id,
          score,
        });
      }
    }

    // マッチしたウォッチ通知を作成
    for (const match of watchMatchResults) {
      await prisma.watchNotification.upsert({
        where: {
          watchId_agentId: {
            watchId: match.watchId,
            agentId,
          },
        },
        create: {
          watchId: match.watchId,
          agentId,
          matchScore: match.score,
          isRead: false,
        },
        update: {
          matchScore: match.score,
          isRead: false,
        },
      });
    }

    // === 求人マッチング ===
    const activeJobs = await prisma.jobPosting.findMany({
      where: { status: "ACTIVE" },
    });

    for (const job of activeJobs) {
      const scoreDetails = calculateJobMatchScore(
        {
          skills: job.skills,
          keywords: job.keywords,
          experienceLevel: job.experienceLevel,
        },
        {
          skills: Array.from(allSkills),
          keywords: Array.from(allKeywords),
          fragments: [], // フラグメントの詳細は省略
        },
      );

      if (scoreDetails.totalScore >= MATCH_THRESHOLD) {
        // UIが期待するキー形式に変換
        const normalizedScoreDetails = {
          skill: scoreDetails.skillScore,
          keyword: scoreDetails.keywordScore,
          experience: scoreDetails.experienceScore,
        };
        await prisma.candidateMatch.upsert({
          where: {
            jobId_agentId: {
              jobId: job.id,
              agentId,
            },
          },
          create: {
            jobId: job.id,
            agentId,
            score: scoreDetails.totalScore,
            scoreDetails: normalizedScoreDetails,
          },
          update: {
            score: scoreDetails.totalScore,
            scoreDetails: normalizedScoreDetails,
            calculatedAt: new Date(),
          },
        });
      }
    }

    logger.info("Auto-matching completed", {
      agentId,
      watchMatches: watchMatchResults.length,
      jobsProcessed: activeJobs.length,
    });
  } catch (error) {
    logger.error("Auto-matching error", error as Error, { agentId, userId });
    // エラーが発生してもメインの処理には影響を与えない
  }
}

export const GET = withUserAuth(async (req, session) => {
  const agent = await prisma.agentProfile.findUnique({
    where: { userId: session.user.userId },
  });

  const fragments = await prisma.fragment.findMany({
    where: { userId: session.user.userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ agent, fragments });
});

const updateAgentSchema = z.object({
  systemPrompt: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLIC", "PRIVATE"]).optional(),
});

export const PATCH = withUserAuth(async (req, session) => {
  const rawBody = await req.json();
  const parsed = updateAgentSchema.safeParse(rawBody);

  if (!parsed.success) {
    throw new ValidationError("入力内容に問題があります", {
      fields: parsed.error.flatten().fieldErrors,
    });
  }

  const { systemPrompt, status } = parsed.data;

  const updateData: { systemPrompt?: string; status?: AgentStatus } = {};

  if (systemPrompt !== undefined) {
    updateData.systemPrompt = systemPrompt;
  }

  if (status !== undefined) {
    updateData.status = status as AgentStatus;
  }

  // 現在のステータスを取得
  const currentAgent = await prisma.agentProfile.findUnique({
    where: { userId: session.user.userId },
  });

  const agent = await prisma.agentProfile.update({
    where: { userId: session.user.userId },
    data: updateData,
  });

  // ステータスがPUBLICに変更された場合、自動マッチングを実行
  if (status === "PUBLIC" && currentAgent && currentAgent.status !== "PUBLIC") {
    await performAutoMatching(agent.id, session.user.userId);
  }

  return NextResponse.json({ agent });
});
