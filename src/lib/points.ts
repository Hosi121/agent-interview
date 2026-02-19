import {
  type PointAction,
  PointTransactionType,
  type Prisma,
} from "@prisma/client";
import {
  InsufficientPointsError,
  NoSubscriptionError,
  SubscriptionInactiveError,
} from "./errors";
import { prisma } from "./prisma";
import { POINT_COSTS } from "./stripe";

type TransactionClient = Prisma.TransactionClient;

const POINT_EXPIRATION_MONTHS = 3;
const CARRYOVER_CAP_RATIO = 0.5;

async function getSubscriptionForUpdate(
  tx: TransactionClient,
  companyId: string,
) {
  const rows = await tx.$queryRaw<
    Array<{
      id: string;
      companyId: string;
      pointBalance: number;
      pointsIncluded: number;
      status: string;
      planType: string;
    }>
  >`SELECT id, "companyId", "pointBalance", "pointsIncluded", status, "planType"
    FROM "Subscription"
    WHERE "companyId" = ${companyId}
    FOR UPDATE`;
  return rows[0] ?? null;
}

function computeExpiresAt() {
  const date = new Date();
  date.setMonth(date.getMonth() + POINT_EXPIRATION_MONTHS);
  return date;
}

async function expirePointsInTx(
  tx: TransactionClient,
  companyId: string,
): Promise<number> {
  const now = new Date();

  const expiredTransactions = await tx.pointTransaction.findMany({
    where: {
      companyId,
      expired: false,
      expiresAt: { lt: now },
      type: { in: [PointTransactionType.GRANT, PointTransactionType.PURCHASE] },
    },
  });

  if (expiredTransactions.length === 0) {
    return 0;
  }

  const totalExpiredAmount = expiredTransactions.reduce(
    (sum, t) => sum + t.amount,
    0,
  );

  // 現在残高を取得して、失効額が残高を超えないようにする
  const currentSub = await tx.subscription.findUnique({
    where: { companyId },
  });
  const currentBalance = currentSub?.pointBalance ?? 0;
  const expireAmount = Math.min(totalExpiredAmount, currentBalance);

  if (expireAmount > 0) {
    const newBalance = currentBalance - expireAmount;

    await tx.subscription.update({
      where: { companyId },
      data: { pointBalance: newBalance },
    });

    await tx.pointTransaction.create({
      data: {
        companyId,
        type: PointTransactionType.EXPIRE,
        amount: -expireAmount,
        balance: newBalance,
        description: `${expireAmount}ポイント失効（有効期限切れ）`,
      },
    });
  }

  await tx.pointTransaction.updateMany({
    where: {
      id: { in: expiredTransactions.map((t) => t.id) },
    },
    data: { expired: true },
  });

  return expireAmount;
}

// Re-export for backward compatibility
export {
  InsufficientPointsError,
  NoSubscriptionError,
  SubscriptionInactiveError,
};

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

  // トランザクションでポイント消費（FOR UPDATEで排他ロック）
  const result = await prisma.$transaction(async (tx) => {
    const subscription = await getSubscriptionForUpdate(tx, companyId);

    if (!subscription) {
      throw new NoSubscriptionError();
    }

    if (subscription.status !== "ACTIVE") {
      throw new SubscriptionInactiveError(subscription.status);
    }

    // 期限切れポイントを失効処理
    await expirePointsInTx(tx, companyId);

    // 失効後の最新残高を再取得
    const refreshed = await tx.subscription.findUnique({
      where: { companyId },
    });
    const currentBalance = refreshed?.pointBalance ?? subscription.pointBalance;

    if (currentBalance < cost) {
      throw new InsufficientPointsError(cost, currentBalance);
    }

    const newBalance = currentBalance - cost;

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
    const subscription = await getSubscriptionForUpdate(tx, companyId);

    if (!subscription) {
      throw new NoSubscriptionError();
    }

    if (subscription.status !== "ACTIVE") {
      throw new SubscriptionInactiveError(subscription.status);
    }

    // 期限切れポイントを失効処理
    await expirePointsInTx(tx, companyId);

    // 失効後の最新残高を再取得
    const refreshed = await tx.subscription.findUnique({
      where: { companyId },
    });
    const currentBalance = refreshed?.pointBalance ?? subscription.pointBalance;

    if (cost > 0 && currentBalance < cost) {
      throw new InsufficientPointsError(cost, currentBalance);
    }

    const newBalance = currentBalance - cost;

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
    const subscription = await getSubscriptionForUpdate(tx, companyId);

    if (!subscription) {
      throw new NoSubscriptionError();
    }

    let currentBalance = subscription.pointBalance;

    // 月次GRANT時の繰越上限チェック
    if (type === PointTransactionType.GRANT) {
      const carryoverCap = Math.floor(
        subscription.pointsIncluded * CARRYOVER_CAP_RATIO,
      );
      if (currentBalance > carryoverCap) {
        const excess = currentBalance - carryoverCap;
        currentBalance = carryoverCap;

        await tx.subscription.update({
          where: { companyId },
          data: { pointBalance: currentBalance },
        });

        await tx.pointTransaction.create({
          data: {
            companyId,
            type: PointTransactionType.EXPIRE,
            amount: -excess,
            balance: currentBalance,
            description: `繰越上限超過により${excess}ポイント失効`,
          },
        });
      }
    }

    const newBalance = currentBalance + amount;

    await tx.subscription.update({
      where: { companyId },
      data: { pointBalance: newBalance },
    });

    const expiresAt =
      type === PointTransactionType.GRANT ||
      type === PointTransactionType.PURCHASE
        ? computeExpiresAt()
        : undefined;

    await tx.pointTransaction.create({
      data: {
        companyId,
        type,
        amount,
        balance: newBalance,
        description: description || "ポイント付与",
        expiresAt,
      },
    });

    return { newBalance };
  });

  return result;
}

/**
 * バッチ処理用: 会社のポイント失効を実行
 */
export async function expirePointsBatch(
  companyId: string,
): Promise<{ expired: number }> {
  const expired = await prisma.$transaction(async (tx) => {
    return expirePointsInTx(tx, companyId);
  });
  return { expired };
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
