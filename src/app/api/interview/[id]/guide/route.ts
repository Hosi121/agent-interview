import { NextResponse } from "next/server";
import { isCompanyAccessDenied } from "@/lib/access-control";
import { withRecruiterAuth } from "@/lib/api-utils";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { generateInterviewGuide } from "@/lib/openai";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withRecruiterAuth<RouteContext>(
  async (req, session, context) => {
    const { id } = await context.params;
    const jobId = req.nextUrl.searchParams.get("jobId");

    if (!jobId) {
      throw new ValidationError("jobId is required");
    }

    const agent = await prisma.agentProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            fragments: {
              select: {
                type: true,
                content: true,
                skills: true,
                keywords: true,
              },
            },
          },
        },
      },
    });

    if (!agent || agent.status !== "PUBLIC") {
      throw new NotFoundError("エージェントが見つかりません");
    }

    if (await isCompanyAccessDenied(session.user.companyId, agent.user.id)) {
      throw new ForbiddenError("アクセスが拒否されています");
    }

    const job = await prisma.jobPosting.findFirst({
      where: {
        id: jobId,
        recruiterId: session.user.recruiterId,
      },
    });

    if (!job) {
      throw new NotFoundError("求人が見つかりません");
    }

    const fragments = agent.user.fragments;
    const candidateSkills = [
      ...new Set(
        fragments.flatMap((f) => f.skills.map((s) => s.toLowerCase())),
      ),
    ];

    const missingSkills = job.skills.filter(
      (skill) => !candidateSkills.includes(skill.toLowerCase()),
    );

    const missingInfoHints: string[] = [];
    if (missingSkills.length > 0) {
      missingInfoHints.push(
        `必須スキルの裏付け不足: ${missingSkills.slice(0, 5).join(", ")}`,
      );
    }

    const achievementCount = fragments.filter(
      (f) => f.type === "ACHIEVEMENT",
    ).length;
    if (achievementCount < 2) {
      missingInfoHints.push("成果・実績の具体例が不足");
    }

    const challengeCount = fragments.filter(
      (f) => f.type === "CHALLENGE",
    ).length;
    if (challengeCount < 1) {
      missingInfoHints.push("課題や困難を乗り越えた経験が不足");
    }

    const learningCount = fragments.filter((f) => f.type === "LEARNING").length;
    if (learningCount < 1) {
      missingInfoHints.push("学びや改善プロセスが不足");
    }

    const fragmentPreview = fragments
      .slice(0, 12)
      .map((f) => `[${f.type}] ${f.content}`)
      .join("\n");

    const candidateSummary = `候補者名: ${agent.user.name}
スキル: ${[...new Set(fragments.flatMap((f) => f.skills))].join(", ") || "なし"}
主な実績: ${
      fragments
        .filter((f) => f.type === "ACHIEVEMENT")
        .slice(0, 3)
        .map((f) => f.content)
        .join(" / ") || "なし"
    }
フラグメント抜粋:
${fragmentPreview || "情報なし"}`;

    const guide = await generateInterviewGuide({
      job: {
        title: job.title,
        description: job.description,
        skills: job.skills,
        experienceLevel: job.experienceLevel,
      },
      candidateSummary,
      missingInfoHints,
    });

    const fallbackQuestions =
      guide.questions.length > 0
        ? guide.questions
        : [
            `${job.title}に関連する主な経験と役割を教えてください`,
            `求人で求めるスキルの中で、最も得意なものと実績を教えてください`,
            `困難だった課題と、それをどう乗り越えたかを教えてください`,
            `成果や数字で示せる実績があれば教えてください`,
            `このポジションで活かせる強みを教えてください`,
          ];

    return NextResponse.json({
      guide: {
        questions: fallbackQuestions,
        missingInfo:
          guide.missingInfo.length > 0 ? guide.missingInfo : missingInfoHints,
        focusAreas: guide.focusAreas || [],
      },
    });
  },
);
