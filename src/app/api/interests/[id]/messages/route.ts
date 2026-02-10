import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api-utils";
import {
  ForbiddenError,
  InsufficientPointsError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { checkPointBalance, consumePointsWithOperations } from "@/lib/points";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

// メッセージ一覧取得
export const GET = withAuth<RouteContext>(async (req, session, context) => {
  const { id: interestId } = await context.params;

  // 興味表明を取得してアクセス権限を確認
  const interest = await prisma.interest.findUnique({
    where: { id: interestId },
  });

  if (!interest) {
    throw new NotFoundError("興味表明が見つかりません");
  }

  // 採用担当者または求職者本人のみアクセス可能
  const isRecruiter = session.user.recruiterId === interest.recruiterId;
  const isUser = session.user.userId === interest.userId;

  if (!isRecruiter && !isUser) {
    throw new ForbiddenError("このメッセージにアクセスする権限がありません");
  }

  const messages = await prisma.directMessage.findMany({
    where: { interestId },
    orderBy: { createdAt: "asc" },
    include: {
      recruiter: {
        select: {
          id: true,
          company: {
            select: {
              name: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return NextResponse.json({
    messages: messages.map((m) => ({
      ...m,
      recruiter: m.recruiter
        ? { id: m.recruiter.id, companyName: m.recruiter.company.name }
        : null,
    })),
  });
});

const sendMessageSchema = z.object({
  content: z.string().min(1, "メッセージを入力してください"),
});

// メッセージ送信（採用担当者のみ3pt消費、求職者は無料）
export const POST = withAuth<RouteContext>(async (req, session, context) => {
  const { id: interestId } = await context.params;
  const rawBody = await req.json();
  const parsed = sendMessageSchema.safeParse(rawBody);

  if (!parsed.success) {
    throw new ValidationError("入力内容に問題があります", {
      fields: parsed.error.flatten().fieldErrors,
    });
  }

  const { content } = parsed.data;

  // 興味表明を取得
  const interest = await prisma.interest.findUnique({
    where: { id: interestId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          accountId: true,
        },
      },
      recruiter: {
        select: {
          id: true,
          companyId: true,
          accountId: true,
          company: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!interest) {
    throw new NotFoundError("興味表明が見つかりません");
  }

  // 連絡先開示済みでないとメッセージ送信不可
  if (interest.status !== "CONTACT_DISCLOSED") {
    throw new ForbiddenError(
      "連絡先が開示されていないため、メッセージを送信できません",
    );
  }

  const isRecruiter = session.user.recruiterId === interest.recruiterId;
  const isUser = session.user.userId === interest.userId;

  if (!isRecruiter && !isUser) {
    throw new ForbiddenError("このメッセージにアクセスする権限がありません");
  }

  // 送信者IDを決定
  const senderId = (
    isRecruiter ? session.user.recruiterId : session.user.userId
  ) as string;

  // 相手の通知先
  const notificationAccountId = isRecruiter
    ? interest.user.accountId
    : interest.recruiter.accountId;

  const notificationBody = isRecruiter
    ? `${interest.recruiter.company.name}からメッセージが届きました`
    : `${interest.user.name}からメッセージが届きました`;

  // 採用担当者の場合はポイント消費 + メッセージ作成を同一トランザクションで
  if (isRecruiter && session.user.companyId) {
    const pointCheck = await checkPointBalance(
      session.user.companyId,
      "MESSAGE_SEND",
    );
    if (!pointCheck.canProceed) {
      throw new InsufficientPointsError(
        pointCheck.required,
        pointCheck.available,
      );
    }

    const { result: message } = await consumePointsWithOperations(
      session.user.companyId,
      "MESSAGE_SEND",
      async (tx) => {
        const msg = await tx.directMessage.create({
          data: {
            interestId,
            senderId,
            senderType: "RECRUITER",
            recruiterId: session.user.recruiterId,
            content: content.trim(),
          },
        });

        await tx.notification.create({
          data: {
            accountId: notificationAccountId,
            type: "SYSTEM",
            title: "新しいメッセージ",
            body: notificationBody,
            data: {
              interestId,
              messageId: msg.id,
            },
          },
        });

        await tx.interest.update({
          where: { id: interestId },
          data: { updatedAt: new Date() },
        });

        return msg;
      },
      interestId,
      `メッセージ送信: ${interest.user.name}`,
    );

    return NextResponse.json({ message }, { status: 201 });
  }

  // 求職者の場合はポイント消費不要だがトランザクションで囲む
  const message = await prisma.$transaction(async (tx) => {
    const msg = await tx.directMessage.create({
      data: {
        interestId,
        senderId,
        senderType: "USER",
        userId: session.user.userId,
        content: content.trim(),
      },
    });

    await tx.notification.create({
      data: {
        accountId: notificationAccountId,
        type: "SYSTEM",
        title: "新しいメッセージ",
        body: notificationBody,
        data: {
          interestId,
          messageId: msg.id,
        },
      },
    });

    await tx.interest.update({
      where: { id: interestId },
      data: { updatedAt: new Date() },
    });

    return msg;
  });

  return NextResponse.json({ message }, { status: 201 });
});
