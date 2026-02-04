import { NextResponse } from "next/server";
import { z } from "zod";
import { withUserAuth } from "@/lib/api-utils";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ interestId: string }> };

// メッセージ一覧取得
export const GET = withUserAuth<RouteContext>(async (req, session, context) => {
  const { interestId } = await context!.params;

  // 自分宛ての興味表明か確認
  const interest = await prisma.interest.findFirst({
    where: {
      id: interestId,
      userId: session.user.userId,
    },
  });

  if (!interest) {
    throw new NotFoundError("興味表明が見つかりません");
  }

  const messages = await prisma.directMessage.findMany({
    where: {
      interestId,
    },
    include: {
      recruiter: {
        select: {
          company: {
            select: {
              name: true,
            },
          },
        },
      },
      user: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      content: m.content,
      senderType: m.senderType,
      createdAt: m.createdAt,
      recruiter: m.recruiter ? { companyName: m.recruiter.company.name } : null,
      user: m.user,
    })),
  });
});

const sendMessageSchema = z.object({
  content: z.string().min(1, "メッセージを入力してください"),
});

// メッセージ送信
export const POST = withUserAuth<RouteContext>(
  async (req, session, context) => {
    const { interestId } = await context!.params;
    const rawBody = await req.json();
    const parsed = sendMessageSchema.safeParse(rawBody);

    if (!parsed.success) {
      throw new ValidationError("入力内容に問題があります", {
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const { content } = parsed.data;

    // 自分宛ての興味表明で、連絡先開示済みか確認
    const interest = await prisma.interest.findFirst({
      where: {
        id: interestId,
        userId: session.user.userId,
        status: "CONTACT_DISCLOSED",
      },
      include: {
        recruiter: {
          select: { accountId: true },
        },
        user: {
          select: { name: true },
        },
      },
    });

    if (!interest) {
      throw new ForbiddenError("メッセージを送信できません");
    }

    const message = await prisma.directMessage.create({
      data: {
        interestId,
        senderId: session.user.userId,
        senderType: "USER",
        userId: session.user.userId,
        content: content.trim(),
      },
      include: {
        user: {
          select: { name: true },
        },
      },
    });

    // 採用担当者に通知を送信
    await prisma.notification.create({
      data: {
        accountId: interest.recruiter.accountId,
        type: "SYSTEM",
        title: "新しいメッセージ",
        body: `${interest.user.name}からメッセージが届きました`,
        data: {
          interestId,
          messageId: message.id,
        },
      },
    });

    // 興味表明のupdatedAtを更新
    await prisma.interest.update({
      where: { id: interestId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json(
      {
        message: {
          id: message.id,
          content: message.content,
          senderType: message.senderType,
          createdAt: message.createdAt,
          user: message.user,
          recruiter: null,
        },
      },
      { status: 201 },
    );
  },
);
