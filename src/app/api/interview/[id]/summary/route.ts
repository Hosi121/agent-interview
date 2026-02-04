import { type NextRequest, NextResponse } from "next/server";
import { isCompanyAccessDenied } from "@/lib/access-control";
import { withRecruiterAuth } from "@/lib/api-utils";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { openai } from "@/lib/openai";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

// 会話の要約を生成
export const GET = withRecruiterAuth<RouteContext>(
  async (req, session, context) => {
    const { id } = await context!.params;

    // エージェントの存在確認
    const agent = await prisma.agentProfile.findUnique({
      where: { id },
      include: {
        user: { select: { name: true } },
      },
    });

    if (!agent) {
      throw new NotFoundError("エージェントが見つかりません");
    }

    if (await isCompanyAccessDenied(session.user.companyId, agent.userId)) {
      throw new ForbiddenError("アクセスが拒否されています");
    }

    // このリクルーターとエージェントのセッションを取得
    const existingSession = await prisma.session.findFirst({
      where: {
        sessionType: "RECRUITER_AGENT_CHAT",
        recruiterId: session.user.recruiterId,
        agentId: id,
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!existingSession || existingSession.messages.length === 0) {
      return NextResponse.json({
        summary: null,
        messageCount: 0,
        lastMessageAt: null,
        evidence: [],
      });
    }

    // 会話を要約するためにOpenAIを使用
    const conversationText = existingSession.messages
      .map((m) => {
        const sender =
          m.senderType === "RECRUITER" ? "採用担当者" : "エージェント";
        return `${sender}: ${m.content}`;
      })
      .join("\n\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1000,
      messages: [
        {
          role: "system",
          content:
            "あなたは採用面接の会話を要約するアシスタントです。日本語で簡潔にまとめてください。",
        },
        {
          role: "user",
          content: `以下は採用担当者と候補者（${agent.user.name}）のAIエージェントとの会話です。
この会話を要約し、以下の観点で整理してください：

1. **会話の概要**: 何について話し合われたか（2-3文）
2. **候補者の強み**: 会話から見えた強みやスキル
3. **確認済み事項**: 会話で確認できた重要な情報
4. **未確認事項**: まだ確認が必要そうな事項（あれば）
5. **全体的な印象**: 候補者の印象（1-2文）

会話内容:
${conversationText}`,
        },
      ],
    });

    const summary = response.choices[0]?.message?.content || "";

    const references = await prisma.messageReference.findMany({
      where: {
        refType: "FRAGMENT",
        message: {
          sessionId: existingSession.id,
        },
      },
      include: {
        message: {
          select: {
            id: true,
            content: true,
          },
        },
      },
    });

    const referenceCounts = new Map<string, number>();
    const referenceMessages = new Map<
      string,
      { messageId: string; snippet: string }[]
    >();
    for (const ref of references) {
      referenceCounts.set(ref.refId, (referenceCounts.get(ref.refId) || 0) + 1);
      const snippets = referenceMessages.get(ref.refId) || [];
      const snippet =
        ref.message.content.length > 50
          ? ref.message.content.slice(0, 50) + "..."
          : ref.message.content;
      // Avoid duplicates
      if (!snippets.some((s) => s.messageId === ref.message.id)) {
        snippets.push({ messageId: ref.message.id, snippet });
      }
      referenceMessages.set(ref.refId, snippets);
    }

    const fragmentIds = Array.from(referenceCounts.keys());
    const fragments =
      fragmentIds.length > 0
        ? await prisma.fragment.findMany({
            where: { id: { in: fragmentIds } },
          })
        : [];

    const evidence = fragments
      .map((fragment) => ({
        id: fragment.id,
        type: fragment.type,
        content:
          fragment.content.length > 160
            ? fragment.content.slice(0, 160) + "..."
            : fragment.content,
        skills: fragment.skills,
        keywords: fragment.keywords,
        count: referenceCounts.get(fragment.id) || 0,
        messageSnippets: referenceMessages.get(fragment.id) || [],
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return NextResponse.json({
      summary,
      messageCount: existingSession.messages.length,
      lastMessageAt:
        existingSession.messages[existingSession.messages.length - 1].createdAt,
      evidence,
    });
  },
);
