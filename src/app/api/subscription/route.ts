import { NextResponse } from "next/server";
import { withRecruiterAuth } from "@/lib/api-utils";
import { ForbiddenError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { PLANS } from "@/lib/stripe";

// サブスクリプション情報取得
export const GET = withRecruiterAuth(async (req, session) => {
  if (!session.user.companyId) {
    throw new ForbiddenError("会社に所属していません");
  }

  const subscription = await prisma.subscription.findUnique({
    where: { companyId: session.user.companyId },
  });

  if (!subscription) {
    return NextResponse.json({
      subscription: null,
      message: "サブスクリプションがありません",
    });
  }

  const planInfo = PLANS[subscription.planType as keyof typeof PLANS];

  return NextResponse.json({
    subscription: {
      ...subscription,
      planName: planInfo.name,
      priceMonthly: planInfo.priceMonthly,
      additionalPointPrice: planInfo.additionalPointPrice,
    },
  });
});
