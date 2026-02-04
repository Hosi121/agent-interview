import { type PlanType, PointTransactionType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withRecruiterValidation } from "@/lib/api-utils";
import { ForbiddenError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { PLANS } from "@/lib/stripe";

const changePlanSchema = z.object({
  planType: z.enum(["LIGHT", "STANDARD", "ENTERPRISE"], {
    message: "無効なプランタイプです",
  }),
});

export const POST = withRecruiterValidation(
  changePlanSchema,
  async (body, req, session) => {
    if (!session.user.companyId) {
      throw new ForbiddenError("会社に所属していません");
    }
    if (
      !session.user.companyRole ||
      (session.user.companyRole !== "OWNER" &&
        session.user.companyRole !== "ADMIN")
    ) {
      throw new ForbiddenError("プラン変更の権限がありません");
    }

    const { planType } = body;
    const companyId = session.user.companyId;
    const planInfo = PLANS[planType as keyof typeof PLANS];

    // 既存のサブスクリプションを確認
    const existingSubscription = await prisma.subscription.findUnique({
      where: { companyId },
    });

    if (existingSubscription) {
      // プラン変更
      const updatedSubscription = await prisma.subscription.update({
        where: { companyId },
        data: {
          planType: planType as PlanType,
          pointsIncluded: planInfo.pointsIncluded,
        },
      });

      return NextResponse.json({
        subscription: updatedSubscription,
        message: "プランを変更しました",
      });
    }

    // 新規サブスクリプション作成
    const newSubscription = await prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.create({
        data: {
          companyId,
          planType: planType as PlanType,
          pointBalance: planInfo.pointsIncluded,
          pointsIncluded: planInfo.pointsIncluded,
          status: "ACTIVE",
        },
      });

      // 初回ポイント付与の履歴を記録
      await tx.pointTransaction.create({
        data: {
          companyId,
          type: PointTransactionType.GRANT,
          amount: planInfo.pointsIncluded,
          balance: planInfo.pointsIncluded,
          description: `${planInfo.name}プラン開始 - 初回ポイント付与`,
        },
      });

      return subscription;
    });

    return NextResponse.json({
      subscription: newSubscription,
      message: "プランを選択しました",
    });
  },
);
