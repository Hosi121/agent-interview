import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isCompanyAccessDenied } from "@/lib/access-control";
import { generateInterviewGuide } from "@/lib/openai";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.recruiterId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const jobId = request.nextUrl.searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json(
        { error: "jobId is required" },
        { status: 400 },
      );
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
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (await isCompanyAccessDenied(session.user.recruiterId, agent.user.id)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const job = await prisma.jobPosting.findFirst({
      where: {
        id: jobId,
        recruiterId: session.user.recruiterId,
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const fragments = agent.user.fragments;
    const candidateSkills = [
      ...new Set(fragments.flatMap((f) => f.skills.map((s) => s.toLowerCase()))),
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

    const learningCount = fragments.filter(
      (f) => f.type === "LEARNING",
    ).length;
    if (learningCount < 1) {
      missingInfoHints.push("学びや改善プロセスが不足");
    }

    const fragmentPreview = fragments
      .slice(0, 12)
      .map((f) => `[${f.type}] ${f.content}`)
      .join("\n");

    const candidateSummary = `候補者名: ${agent.user.name}
スキル: ${[...new Set(fragments.flatMap((f) => f.skills))].join(", ") || "なし"}
主な実績: ${fragments
      .filter((f) => f.type === "ACHIEVEMENT")
      .slice(0, 3)
      .map((f) => f.content)
      .join(" / ") || "なし"}
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
  } catch (error) {
    console.error("Interview guide error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
