import { NextResponse } from "next/server";
import { z } from "zod";
import { withUserAuth } from "@/lib/api-utils";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { checkPointBalance, consumePointsWithOperations } from "@/lib/points";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ interestId: string }> };

const approveSchema = z.object({
  preference: z.enum(["ALLOW", "NONE"]).optional().default("NONE"),
});

export const POST = withUserAuth<RouteContext>(
  async (req, session, context) => {
    const { interestId } = await context.params;
    const rawBody = await req.json().catch(() => ({}));
    const parsed = approveSchema.safeParse(rawBody);

    const preference = parsed.success ? parsed.data.preference : "NONE";

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

    if (interest.userId !== session.user.userId) {
      throw new ForbiddenError("この操作を行う権限がありません");
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
      throw new ConflictError("既に辞退済みです");
    }

    if (interest.status !== "CONTACT_REQUESTED") {
      throw new ValidationError("連絡先開示リクエストがありません");
    }

    const pointCheck = await checkPointBalance(
      interest.recruiter.companyId,
      "CONTACT_DISCLOSURE",
    );

    if (!pointCheck.canProceed) {
      throw new ConflictError("企業側のポイントが不足しています");
    }

    await consumePointsWithOperations(
      interest.recruiter.companyId,
      "CONTACT_DISCLOSURE",
      async (tx) => {
        await tx.interest.update({
          where: { id: interestId },
          data: { status: "CONTACT_DISCLOSED" },
        });

        if (preference === "ALLOW") {
          await tx.companyAccess.upsert({
            where: {
              userId_companyId: {
                userId: interest.userId,
                companyId: interest.recruiter.companyId,
              },
            },
            create: {
              userId: interest.userId,
              companyId: interest.recruiter.companyId,
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
  },
);
