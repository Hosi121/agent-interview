import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 通知一覧取得
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.recruiterId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    // ウォッチ通知を取得
    const watchNotifications = await prisma.watchNotification.findMany({
      where: {
        watch: {
          recruiterId: session.user.recruiterId,
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

    // 統合して返す
    const notifications = [
      ...watchNotifications.map((n) => ({
        id: n.id,
        type: "NEW_CANDIDATE_MATCH" as const,
        title: "新しい候補者がマッチしました",
        body: `${n.agent.user.name}さんが「${n.watch.name}」の条件にマッチしました（${Math.round(n.matchScore * 100)}%）`,
        data: {
          watchId: n.watch.id,
          agentId: n.agent.id,
          matchScore: n.matchScore,
        },
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
      ...systemNotifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.data,
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
  } catch (error) {
    console.error("Get notifications error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// 通知を既読にする
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.recruiterId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { notificationIds, markAllAsRead } = body;

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
  } catch (error) {
    console.error("Mark notifications read error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
