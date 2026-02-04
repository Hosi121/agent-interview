import { NextResponse } from "next/server";
import { withUserAuth } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

// 求職者の受信した興味表明一覧を取得
export const GET = withUserAuth(async (req, session) => {
  const interests = await prisma.interest.findMany({
    where: {
      userId: session.user.userId,
    },
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
      directMessages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      _count: {
        select: {
          directMessages: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  // 未読メッセージ数を計算（後で実装するisRead機能用のプレースホルダー）
  const formattedInterests = interests.map((interest) => ({
    id: interest.id,
    status: interest.status,
    message: interest.message,
    createdAt: interest.createdAt,
    updatedAt: interest.updatedAt,
    recruiter: {
      id: interest.recruiter.id,
      companyName: interest.recruiter.company.name,
    },
    lastMessage: interest.directMessages[0] || null,
    messageCount: interest._count.directMessages,
  }));

  return NextResponse.json({
    interests: formattedInterests,
  });
});
