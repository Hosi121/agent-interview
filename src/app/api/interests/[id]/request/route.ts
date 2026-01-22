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

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.recruiterId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: interestId } = await params;

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
      return NextResponse.json(
        { error: "興味表明が見つかりません" },
        { status: 404 },
      );
    }

    if (interest.recruiterId !== session.user.recruiterId) {
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
        { error: "候補者が辞退しました", status: interest.status },
        { status: 409 },
      );
    }

    const accessPreference = await prisma.companyAccess.findUnique({
      where: {
        userId_recruiterId: {
          userId: interest.userId,
          recruiterId: interest.recruiterId,
        },
      },
    });

    if (accessPreference?.status === "DENY") {
      if (interest.status !== "DECLINED") {
        await prisma.interest.update({
          where: { id: interestId },
          data: { status: "DECLINED" },
        });
      }

      await prisma.notification.create({
        data: {
          accountId: interest.recruiter.accountId,
          type: "SYSTEM",
          title: "連絡先開示が辞退されました",
          body: `${interest.user.name}が連絡先開示を辞退しました`,
          data: {
            interestId,
            recruiterId: interest.recruiterId,
            userId: interest.userId,
          },
        },
      });

      return NextResponse.json({ status: "DECLINED", auto: true });
    }

    if (accessPreference?.status === "ALLOW") {
      const pointCheck = await checkPointBalance(
        session.user.recruiterId,
        "CONTACT_DISCLOSURE",
      );
      if (!pointCheck.canProceed) {
        return NextResponse.json(
          {
            error: "ポイントが不足しています",
            required: pointCheck.required,
            available: pointCheck.available,
          },
          { status: 402 },
        );
      }

      await consumePointsWithOperations(
        session.user.recruiterId,
        "CONTACT_DISCLOSURE",
        async (tx) => {
          await tx.interest.update({
            where: { id: interestId },
            data: { status: "CONTACT_DISCLOSED" },
          });

          await tx.notification.create({
            data: {
              accountId: interest.user.accountId,
              type: "PIPELINE_UPDATE",
              title: "連絡先が自動で開示されました",
              body: `${interest.recruiter.companyName}に連絡先が開示されました`,
              data: {
                interestId,
                recruiterId: interest.recruiterId,
                companyName: interest.recruiter.companyName,
              },
            },
          });
        },
        interestId,
        `連絡先開示: ${interest.user.name}`,
      );

      return NextResponse.json({
        status: "CONTACT_DISCLOSED",
        auto: true,
        contact: {
          name: interest.user.name,
          email: interest.user.email,
          phone: interest.user.phone,
        },
      });
    }

    if (interest.status !== "CONTACT_REQUESTED") {
      await prisma.interest.update({
        where: { id: interestId },
        data: { status: "CONTACT_REQUESTED" },
      });

      await prisma.notification.create({
        data: {
          accountId: interest.user.accountId,
          type: "SYSTEM",
          title: "連絡先開示のリクエスト",
          body: `${interest.recruiter.companyName}が連絡先開示をリクエストしました`,
          data: {
            interestId,
            recruiterId: interest.recruiterId,
            companyName: interest.recruiter.companyName,
          },
        },
      });
    }

    return NextResponse.json({ status: "CONTACT_REQUESTED" });
  } catch (error) {
    console.error("Contact request error:", error);

    if (error instanceof NoSubscriptionError) {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }

    if (error instanceof InsufficientPointsError) {
      return NextResponse.json(
        {
          error: error.message,
          required: error.required,
          available: error.available,
        },
        { status: 402 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
