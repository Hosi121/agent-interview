import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRecruiterAuth } from "@/lib/api-utils";
import { ValidationError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

// 通知一覧取得
export const GET = withRecruiterAuth(async (req, session) => {
  const searchParams = req.nextUrl.searchParams;
  const unreadOnly = searchParams.get("unreadOnly") === "true";

  // ウォッチ通知を取得
  const watchNotifications = await prisma.watchNotification.findMany({
    where: {
      watch: {
        recruiterId: session.user.recruiterId,
      },
      agent: {
        user: {
          companyAccesses: {
            none: {
              companyId: session.user.companyId,
              status: "DENY",
            },
          },
        },
      },
      ...(unreadOnly && { isRead: false }),
    },
    include: {
      watch: {
        select: { id: true, name: true },
      },
      agent: {
        include: {
          user: {
            select: { name: true },
          },
        },
      },
    },
    orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
    take: 50,
  });

  // システム通知を取得
  const systemNotifications = await prisma.notification.findMany({
    where: {
      accountId: session.user.accountId,
      ...(unreadOnly && { isRead: false }),
    },
    orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
    take: 20,
  });

  // 統合して返す（UIが期待するフィールド名に変換）
  const notifications = [
    ...watchNotifications.map((n) => ({
      id: n.id,
      type: "NEW_CANDIDATE_MATCH" as const,
      title: "新しい候補者がマッチしました",
      message: `${n.agent.user.name}さんが「${n.watch.name}」の条件にマッチしました（${Math.round(n.matchScore * 100)}%）`,
      watch: {
        name: n.watch.name,
      },
      relatedAgent: {
        id: n.agent.id,
        user: {
          name: n.agent.user.name,
        },
      },
      isRead: n.isRead,
      createdAt: n.createdAt,
    })),
    ...systemNotifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.body,
      watch: null,
      relatedAgent: null,
      isRead: n.isRead,
      createdAt: n.createdAt,
    })),
  ].sort((a, b) => {
    if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return NextResponse.json({
    notifications,
    unreadCount,
  });
});

const markReadSchema = z.object({
  notificationIds: z.array(z.string()).optional(),
  markAllAsRead: z.boolean().optional(),
});

// 通知を既読にする
export const PATCH = withRecruiterAuth(async (req, session) => {
  const rawBody = await req.json();
  const parsed = markReadSchema.safeParse(rawBody);

  if (!parsed.success) {
    throw new ValidationError("入力内容に問題があります", {
      fields: parsed.error.flatten().fieldErrors,
    });
  }

  const { notificationIds, markAllAsRead } = parsed.data;

  if (markAllAsRead) {
    await prisma.watchNotification.updateMany({
      where: {
        watch: {
          recruiterId: session.user.recruiterId,
        },
        isRead: false,
      },
      data: { isRead: true },
    });

    await prisma.notification.updateMany({
      where: {
        accountId: session.user.accountId,
        isRead: false,
      },
      data: { isRead: true },
    });
  } else if (notificationIds && Array.isArray(notificationIds)) {
    await prisma.watchNotification.updateMany({
      where: {
        id: { in: notificationIds },
        watch: {
          recruiterId: session.user.recruiterId,
        },
      },
      data: { isRead: true },
    });

    await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
        accountId: session.user.accountId,
      },
      data: { isRead: true },
    });
  }

  return NextResponse.json({ success: true });
});
