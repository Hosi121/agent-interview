import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isCompanyAccessDenied } from "@/lib/access-control";
import { withRecruiterAuth } from "@/lib/api-utils";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { prisma } from "@/lib/prisma";

// 興味表明一覧取得
export const GET = withRecruiterAuth(async (req, session) => {
  const interests = await prisma.interest.findMany({
    where: {
      recruiterId: session.user.recruiterId,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          agent: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // 連絡先は開示済みの場合のみ返す
  const sanitizedInterests = interests.map((interest) => ({
    ...interest,
    user: {
      ...interest.user,
      email:
        interest.status === "CONTACT_DISCLOSED" ? interest.user.email : null,
      phone:
        interest.status === "CONTACT_DISCLOSED" ? interest.user.phone : null,
    },
  }));

  return NextResponse.json({ interests: sanitizedInterests });
});

const createInterestSchema = z.object({
  agentId: z.string().min(1, "エージェントIDが必要です"),
  message: z.string().optional(),
});

// 興味表明（無料）
export const POST = withRecruiterAuth(async (req, session) => {
  const rawBody = await req.json();
  const parsed = createInterestSchema.safeParse(rawBody);

  if (!parsed.success) {
    throw new ValidationError("入力内容に問題があります", {
      fields: parsed.error.flatten().fieldErrors,
    });
  }

  const { agentId, message } = parsed.data;

  // エージェントとユーザーを取得
  const agent = await prisma.agentProfile.findUnique({
    where: { id: agentId },
    include: { user: true },
  });

  if (!agent) {
    throw new NotFoundError("エージェントが見つかりません");
  }

  if (agent.status !== "PUBLIC") {
    throw new ForbiddenError("このエージェントは非公開です");
  }

  if (await isCompanyAccessDenied(session.user.companyId, agent.userId)) {
    throw new ForbiddenError("この候補者へのアクセスが制限されています");
  }

  // 既存の興味表明をチェック
  const existingInterest = await prisma.interest.findUnique({
    where: {
      recruiterId_userId: {
        recruiterId: session.user.recruiterId,
        userId: agent.userId,
      },
    },
  });

  if (existingInterest) {
    throw new ConflictError("既に興味表明済みです");
  }

  // 興味表明を作成
  const interest = await prisma.interest.create({
    data: {
      recruiterId: session.user.recruiterId,
      userId: agent.userId,
      agentId,
      message: message || null,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // 求職者に通知を作成
  const companyName = session.user.companyName || "企業";
  await prisma.notification.create({
    data: {
      accountId: agent.user.accountId,
      type: "NEW_CANDIDATE_MATCH",
      title: "企業からの興味表明",
      body: `${companyName}があなたに興味を持っています`,
      data: {
        interestId: interest.id,
        recruiterId: session.user.recruiterId,
        companyName,
      },
    },
  });

  return NextResponse.json({ interest }, { status: 201 });
});
