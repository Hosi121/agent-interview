import { PointTransactionType } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PLANS } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.recruiterId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const recruiterId = session.user.recruiterId;
    const { amount } = await req.json();

    if (!amount || typeof amount !== "number" || amount < 10) {
      return NextResponse.json(
        { error: "最低10ポイントから購入できます" },
        { status: 400 },
      );
    }

    // サブスクリプションを確認
    const subscription = await prisma.subscription.findUnique({
      where: { recruiterId },
    });

    if (!subscription) {
      return NextResponse.json(
        {
          error:
            "サブスクリプションがありません。先にプランを選択してください。",
        },
        { status: 400 },
      );
    }

    const planInfo = PLANS[subscription.planType as keyof typeof PLANS];
    const totalPrice = amount * planInfo.additionalPointPrice;

    // トランザクションでポイント追加
    const result = await prisma.$transaction(async (tx) => {
      const newBalance = subscription.pointBalance + amount;

      // サブスクリプションの残高を更新
      const updatedSubscription = await tx.subscription.update({
        where: { recruiterId: recruiterId },
        data: { pointBalance: newBalance },
      });

      // 取引履歴を記録
      await tx.pointTransaction.create({
        data: {
          recruiterId: recruiterId,
          type: PointTransactionType.PURCHASE,
          amount: amount,
          balance: newBalance,
          description: `${amount}ポイント追加購入 (¥${totalPrice.toLocaleString()})`,
        },
      });

      return { newBalance, updatedSubscription };
    });

    return NextResponse.json({
      success: true,
      newBalance: result.newBalance,
      purchased: amount,
      price: totalPrice,
    });
  } catch (error) {
    console.error("Purchase points error:", error);
    return NextResponse.json(
      { error: "ポイント購入に失敗しました" },
      { status: 500 },
    );
  }
}
