import { NextResponse } from "next/server";
import { z } from "zod";
import { withUserAuth } from "@/lib/api-utils";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ interestId: string }> };

const declineSchema = z.object({
  preference: z.enum(["DENY", "NONE"]).optional().default("NONE"),
});

export const POST = withUserAuth<RouteContext>(
  async (req, session, context) => {
    const { interestId } = await context.params;
    const rawBody = await req.json().catch(() => ({}));
    const parsed = declineSchema.safeParse(rawBody);

    const preference = parsed.success ? parsed.data.preference : "NONE";

    const interest = await prisma.interest.findUnique({
      where: { id: interestId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
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
      throw new ConflictError("既に連絡先が開示されています");
    }

    await prisma.$transaction(async (tx) => {
      if (interest.status !== "DECLINED") {
        await tx.interest.update({
          where: { id: interestId },
          data: { status: "DECLINED" },
        });
      }

      if (preference === "DENY") {
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
            status: "DENY",
          },
          update: { status: "DENY" },
        });
      }

      await tx.notification.create({
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
    });

    return NextResponse.json({ status: "DECLINED" });
  },
);
