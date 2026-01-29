import { type NextRequest, NextResponse } from "next/server";
import { withRecruiterAuth } from "@/lib/api-utils";
import {
  ConflictError,
  ForbiddenError,
  InsufficientPointsError,
  NotFoundError,
} from "@/lib/errors";
import { checkPointBalance, consumePointsWithOperations } from "@/lib/points";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export const POST = withRecruiterAuth<RouteContext>(
  async (req, session, context) => {
    const { id: interestId } = await context!.params;

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
      throw new NotFoundError("興味表明が見つかりません");
    }

    if (interest.recruiterId !== session.user.recruiterId) {
      throw new ForbiddenError("この興味表明にアクセスする権限がありません");
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
      throw new ConflictError("候補者が辞退しました");
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
      await prisma.interest.update({
        where: { id: interestId },
        data: { status: "DECLINED" },
      });

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
        throw new InsufficientPointsError(
          pointCheck.required,
          pointCheck.available,
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
  },
);
