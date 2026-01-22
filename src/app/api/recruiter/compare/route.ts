import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { openai } from "@/lib/openai";
import { prisma } from "@/lib/prisma";

// 候補者比較レポート生成
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.recruiterId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { agentIds, jobId } = body;

    if (!agentIds || !Array.isArray(agentIds) || agentIds.length < 2) {
      return NextResponse.json(
        { error: "At least 2 agentIds are required" },
        { status: 400 },
      );
    }

    if (agentIds.length > 5) {
      return NextResponse.json(
        { error: "Maximum 5 candidates can be compared at once" },
        { status: 400 },
      );
    }

    // 候補者情報を取得
    const agents = await prisma.agentProfile.findMany({
      where: {
        id: { in: agentIds },
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
          select: {
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

    if (agents.length !== agentIds.length) {
      return NextResponse.json(
        { error: "Some agents not found or not public" },
        { status: 404 },
      );
    }

    // 求人情報を取得（指定されている場合）
    let job = null;
    if (jobId) {
      job = await prisma.jobPosting.findFirst({
        where: {
          id: jobId,
          recruiterId: session.user.recruiterId,
        },
      });
    }

    // 面接評価も取得
    const evaluations = await prisma.interviewEvaluation.findMany({
      where: {
        recruiterId: session.user.recruiterId,
        session: {
          agentId: { in: agentIds },
        },
      },
      include: {
        session: {
          select: { agentId: true },
        },
      },
    });

    // 候補者ごとの評価をマップ
    const evalByAgent = new Map<string, (typeof evaluations)[0]>();
    for (const ev of evaluations) {
      if (ev.session.agentId) {
        evalByAgent.set(ev.session.agentId, ev);
      }
    }

    // 候補者データを整形
    const candidatesData = agents.map((agent) => {
      const fragments = agent.user.fragments;
      const skills = [...new Set(fragments.flatMap((f) => f.skills))];
      const achievements = fragments
        .filter((f) => f.type === "ACHIEVEMENT")
        .map((f) => f.content);
      const evaluation = evalByAgent.get(agent.id);

      return {
        id: agent.id,
        name: agent.user.name,
        skills,
        achievements: achievements.slice(0, 3),
        fragmentCounts: {
          total: fragments.length,
          achievement: fragments.filter((f) => f.type === "ACHIEVEMENT").length,
          skill: fragments.filter((f) => f.type === "SKILL_USAGE").length,
          fact: fragments.filter((f) => f.type === "FACT").length,
        },
        evaluation: evaluation
          ? {
              overall: evaluation.overallRating,
              technical: evaluation.technicalRating,
              communication: evaluation.communicationRating,
              culture: evaluation.cultureRating,
              comment: evaluation.comment,
            }
          : null,
      };
    });

    // AI による比較分析
    const comparisonPrompt = `
以下の候補者を比較分析してください。

${job ? `## 求人情報\nタイトル: ${job.title}\n説明: ${job.description}\n必須スキル: ${job.skills.join(", ")}\n経験レベル: ${job.experienceLevel}` : ""}

## 候補者情報
${candidatesData
  .map(
    (c, i) => `
### 候補者${i + 1}: ${c.name}
- スキル: ${c.skills.join(", ") || "なし"}
- 主な実績: ${c.achievements.join(" / ") || "なし"}
- 記憶のかけら数: ${c.fragmentCounts.total}件
${c.evaluation ? `- 面接評価: 総合${c.evaluation.overall}/5, 技術${c.evaluation.technical}/5, コミュニケーション${c.evaluation.communication}/5` : "- 面接評価: 未実施"}
`,
  )
  .join("\n")}

以下の形式でJSON形式で回答してください:
{
  "summary": "全体的な比較サマリー（100文字程度）",
  "comparison": {
    "skills": "スキル面での比較",
    "experience": "経験・実績での比較",
    "fit": "求人へのフィット度（求人情報がある場合）"
  },
  "recommendation": "採用判断へのアドバイス",
  "rankings": {
    "overall": ["候補者名（1位）", "候補者名（2位）", ...],
    "technical": ["候補者名（1位）", "候補者名（2位）", ...],
    "communication": ["候補者名（1位）", "候補者名（2位）", ...]
  }
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "あなたは採用担当者をサポートするアシスタントです。客観的かつ公平に候補者を分析してください。",
        },
        {
          role: "user",
          content: comparisonPrompt,
        },
      ],
      temperature: 0.5,
      max_tokens: 2000,
    });

    const aiResponse = response.choices[0]?.message?.content || "";

    let analysis = null;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // JSON解析失敗時はテキストのまま
      analysis = { summary: aiResponse };
    }

    return NextResponse.json({
      candidates: candidatesData,
      job: job
        ? {
            id: job.id,
            title: job.title,
            skills: job.skills,
            experienceLevel: job.experienceLevel,
          }
        : null,
      analysis,
    });
  } catch (error) {
    console.error("Compare candidates error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
