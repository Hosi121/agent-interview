import { NextResponse } from "next/server";
import { z } from "zod";
import { withUserAuth } from "@/lib/api-utils";
import { ValidationError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

// 求職者の通知一覧取得
export const GET = withUserAuth(async (req, session) => {
  const searchParams = req.nextUrl.searchParams;
  const unreadOnly = searchParams.get("unreadOnly") === "true";

  // 通知を取得（興味表明の通知も含む）
  const notifications = await prisma.notification.findMany({
    where: {
      accountId: session.user.accountId,
      ...(unreadOnly && { isRead: false }),
    },
    orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
    take: 50,
  });

  // 通知データを整形
  const formattedNotifications = notifications.map((n) => {
    const data = n.data as {
      interestId?: string;
      companyName?: string;
    } | null;
    return {
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.body,
      isRead: n.isRead,
      createdAt: n.createdAt,
      relatedInterest: data?.interestId
        ? {
            id: data.interestId,
            companyName: data.companyName || "",
          }
        : null,
    };
  });

  const unreadCount = formattedNotifications.filter((n) => !n.isRead).length;

  return NextResponse.json({
    notifications: formattedNotifications,
    unreadCount,
  });
});

const markReadSchema = z.object({
  notificationIds: z.array(z.string()).optional(),
  markAllAsRead: z.boolean().optional(),
});

// 通知を既読にする
export const PATCH = withUserAuth(async (req, session) => {
  const rawBody = await req.json();
  const parsed = markReadSchema.safeParse(rawBody);

  if (!parsed.success) {
    throw new ValidationError("入力内容に問題があります", {
      fields: parsed.error.flatten().fieldErrors,
    });
  }

  const { notificationIds, markAllAsRead } = parsed.data;

  if (markAllAsRead) {
    await prisma.notification.updateMany({
      where: {
        accountId: session.user.accountId,
        isRead: false,
      },
      data: { isRead: true },
    });
  } else if (notificationIds && Array.isArray(notificationIds)) {
    // interest-で始まるIDはスキップ（興味表明の既読管理は別途）
    const systemNotificationIds = notificationIds.filter(
      (id: string) => !id.startsWith("interest-"),
    );

    if (systemNotificationIds.length > 0) {
      await prisma.notification.updateMany({
        where: {
          id: { in: systemNotificationIds },
          accountId: session.user.accountId,
        },
        data: { isRead: true },
      });
    }
  }

  return NextResponse.json({ success: true });
});
