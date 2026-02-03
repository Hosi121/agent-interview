import {
  type PointAction,
  PointTransactionType,
  type Prisma,
} from "@prisma/client";
import { InsufficientPointsError, NoSubscriptionError } from "./errors";
import { prisma } from "./prisma";
import { POINT_COSTS } from "./stripe";

type TransactionClient = Prisma.TransactionClient;

// Re-export for backward compatibility
export { InsufficientPointsError, NoSubscriptionError };

/**
 * 会社のポイント残高を取得
 */
export async function getPointBalance(companyId: string): Promise<number> {
  const subscription = await prisma.subscription.findUnique({
    where: { companyId },
  });

  if (!subscription) {
    throw new NoSubscriptionError();
  }

  return subscription.pointBalance;
}

/**
 * ポイントが足りるかチェック
 */
export async function checkPointBalance(
  companyId: string,
  action: keyof typeof POINT_COSTS,
): Promise<{ canProceed: boolean; required: number; available: number }> {
  const required = POINT_COSTS[action];

  if (required === 0) {
    return { canProceed: true, required: 0, available: 0 };
  }

  const subscription = await prisma.subscription.findUnique({
    where: { companyId },
  });

  if (!subscription) {
    throw new NoSubscriptionError();
  }

  return {
    canProceed: subscription.pointBalance >= required,
    required,
    available: subscription.pointBalance,
  };
}

/**
 * ポイントを消費
 */
export async function consumePoints(
  companyId: string,
  action: PointAction,
  relatedId?: string,
  description?: string,
): Promise<{ newBalance: number; consumed: number }> {
  const actionKey = action as keyof typeof POINT_COSTS;
  const cost = POINT_COSTS[actionKey];

  if (cost === 0) {
    const subscription = await prisma.subscription.findUnique({
      where: { companyId },
    });
    return { newBalance: subscription?.pointBalance || 0, consumed: 0 };
  }

  // トランザクションでポイント消費
  const result = await prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.findUnique({
      where: { companyId },
    });

    if (!subscription) {
      throw new NoSubscriptionError();
    }

    if (subscription.pointBalance < cost) {
      throw new InsufficientPointsError(cost, subscription.pointBalance);
    }

    const newBalance = subscription.pointBalance - cost;

    // サブスクリプションの残高を更新
    await tx.subscription.update({
      where: { companyId },
      data: { pointBalance: newBalance },
    });

    // 取引履歴を記録
    await tx.pointTransaction.create({
      data: {
        companyId,
        type: PointTransactionType.CONSUME,
        action,
        amount: -cost,
        balance: newBalance,
        relatedId,
        description:
          description || `${getActionDescription(action)}によるポイント消費`,
      },
    });

    return { newBalance, consumed: cost };
  });

  return result;
}

/**
 * ポイントを消費し、追加の操作をトランザクション内で実行
 */
export async function consumePointsWithOperations<T>(
  companyId: string,
  action: PointAction,
  operations: (tx: TransactionClient) => Promise<T>,
  relatedId?: string,
  description?: string,
): Promise<{ newBalance: number; consumed: number; result: T }> {
  const actionKey = action as keyof typeof POINT_COSTS;
  const cost = POINT_COSTS[actionKey];

  const result = await prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.findUnique({
      where: { companyId },
    });

    if (!subscription) {
      throw new NoSubscriptionError();
    }

    if (cost > 0 && subscription.pointBalance < cost) {
      throw new InsufficientPointsError(cost, subscription.pointBalance);
    }

    const newBalance = subscription.pointBalance - cost;

    if (cost > 0) {
      // サブスクリプションの残高を更新
      await tx.subscription.update({
        where: { companyId },
        data: { pointBalance: newBalance },
      });

      // 取引履歴を記録
      await tx.pointTransaction.create({
        data: {
          companyId,
          type: PointTransactionType.CONSUME,
          action,
          amount: -cost,
          balance: newBalance,
          relatedId,
          description:
            description || `${getActionDescription(action)}によるポイント消費`,
        },
      });
    }

    // 追加の操作を実行
    const operationResult = await operations(tx);

    return { newBalance, consumed: cost, result: operationResult };
  });

  return result;
}

/**
 * ポイントを付与
 */
export async function grantPoints(
  companyId: string,
  amount: number,
  type: PointTransactionType,
  description?: string,
): Promise<{ newBalance: number }> {
  const result = await prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.findUnique({
      where: { companyId },
    });

    if (!subscription) {
      throw new NoSubscriptionError();
    }

    const newBalance = subscription.pointBalance + amount;

    await tx.subscription.update({
      where: { companyId },
      data: { pointBalance: newBalance },
    });

    await tx.pointTransaction.create({
      data: {
        companyId,
        type,
        amount,
        balance: newBalance,
        description: description || "ポイント付与",
      },
    });

    return { newBalance };
  });

  return result;
}

/**
 * ポイント取引履歴を取得
 */
export async function getPointHistory(
  companyId: string,
  limit = 50,
  offset = 0,
) {
  return prisma.pointTransaction.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });
}

function getActionDescription(action: PointAction): string {
  switch (action) {
    case "CONVERSATION":
      return "エージェント会話";
    case "CONTACT_DISCLOSURE":
      return "連絡先開示";
    case "MESSAGE_SEND":
      return "メッセージ送信";
    default:
      return action;
  }
}
