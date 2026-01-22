import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isCompanyAccessDenied } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

// 興味表明一覧取得
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.recruiterId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
  } catch (error) {
    console.error("Get interests error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// 興味表明（無料）
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.recruiterId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { agentId, message } = await req.json();

    if (!agentId) {
      return NextResponse.json(
        { error: "エージェントIDが必要です" },
        { status: 400 },
      );
    }

    // エージェントとユーザーを取得
    const agent = await prisma.agentProfile.findUnique({
      where: { id: agentId },
      include: { user: true },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "エージェントが見つかりません" },
        { status: 404 },
      );
    }

    if (agent.status !== "PUBLIC") {
      return NextResponse.json(
        { error: "このエージェントは非公開です" },
        { status: 403 },
      );
    }

    if (await isCompanyAccessDenied(session.user.recruiterId, agent.userId)) {
      return NextResponse.json(
        { error: "この候補者へのアクセスが制限されています" },
        { status: 403 },
      );
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
      return NextResponse.json(
        { error: "既に興味表明済みです", interest: existingInterest },
        { status: 409 },
      );
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
    await prisma.notification.create({
      data: {
        accountId: agent.user.accountId,
        type: "NEW_CANDIDATE_MATCH",
        title: "企業からの興味表明",
        body: `${session.user.companyName}があなたに興味を持っています`,
        data: {
          interestId: interest.id,
          recruiterId: session.user.recruiterId,
          companyName: session.user.companyName,
        },
      },
    });

    return NextResponse.json({ interest }, { status: 201 });
  } catch (error) {
    console.error("Create interest error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
