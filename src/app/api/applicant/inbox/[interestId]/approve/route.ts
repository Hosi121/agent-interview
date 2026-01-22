import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  checkPointBalance,
  consumePointsWithOperations,
  InsufficientPointsError,
  NoSubscriptionError,
} from "@/lib/points";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ interestId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { interestId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const preference =
      body.preference === "ALLOW" ? "ALLOW" : ("NONE" as const);

    const interest = await prisma.interest.findUnique({
      where: { id: interestId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            accountId: true,
          },
        },
        recruiter: {
          select: {
            id: true,
            companyName: true,
            accountId: true,
          },
        },
      },
    });

    if (!interest) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (interest.userId !== session.user.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (interest.status === "CONTACT_DISCLOSED") {
      return NextResponse.json({
        status: interest.status,
        contact: {
          name: interest.user.name,
          email: interest.user.email,
          phone: interest.user.phone,
        },
      });
    }

    if (interest.status === "DECLINED") {
      return NextResponse.json(
        { error: "既に辞退済みです" },
        { status: 409 },
      );
    }

    if (interest.status !== "CONTACT_REQUESTED") {
      return NextResponse.json(
        { error: "連絡先開示リクエストがありません" },
        { status: 400 },
      );
    }

    const pointCheck = await checkPointBalance(
      interest.recruiterId,
      "CONTACT_DISCLOSURE",
    );

    if (!pointCheck.canProceed) {
      return NextResponse.json(
        {
          error: "企業側のポイントが不足しています",
          required: pointCheck.required,
          available: pointCheck.available,
        },
        { status: 409 },
      );
    }

    await consumePointsWithOperations(
      interest.recruiterId,
      "CONTACT_DISCLOSURE",
      async (tx) => {
        await tx.interest.update({
          where: { id: interestId },
          data: { status: "CONTACT_DISCLOSED" },
        });

        if (preference === "ALLOW") {
          await tx.companyAccess.upsert({
            where: {
              userId_recruiterId: {
                userId: interest.userId,
                recruiterId: interest.recruiterId,
              },
            },
            create: {
              userId: interest.userId,
              recruiterId: interest.recruiterId,
              status: "ALLOW",
            },
            update: { status: "ALLOW" },
          });
        }

        await tx.notification.create({
          data: {
            accountId: interest.recruiter.accountId,
            type: "PIPELINE_UPDATE",
            title: "連絡先が開示されました",
            body: `${interest.user.name}が連絡先を開示しました`,
            data: {
              interestId,
              recruiterId: interest.recruiterId,
              userId: interest.userId,
            },
          },
        });
      },
      interestId,
      `連絡先開示: ${interest.user.name}`,
    );

    return NextResponse.json({
      status: "CONTACT_DISCLOSED",
      contact: {
        name: interest.user.name,
        email: interest.user.email,
        phone: interest.user.phone,
      },
    });
  } catch (error) {
    console.error("Approve contact disclosure error:", error);
    if (error instanceof NoSubscriptionError) {
      return NextResponse.json(
        { error: "企業側のサブスクリプションがありません" },
        { status: 409 },
      );
    }

    if (error instanceof InsufficientPointsError) {
      return NextResponse.json(
        {
          error: error.message,
          required: error.required,
          available: error.available,
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
