import crypto from "node:crypto";
import { sendVerificationEmail } from "./email";
import { ValidationError } from "./errors";
import { prisma } from "./prisma";

const COOLDOWN_SECONDS = 60;
const TOKEN_EXPIRY_HOURS = 24;

export async function createAndSendVerificationToken(
  accountId: string,
  email: string,
): Promise<void> {
  // トランザクション内でクールダウンチェック + トークン作成を原子的に実行
  // （TOCTOU防止: 同時リクエストによるクールダウンバイパスを防ぐ）
  const token = await prisma.$transaction(async (tx) => {
    const recentToken = await tx.emailVerificationToken.findFirst({
      where: { accountId },
      orderBy: { createdAt: "desc" },
    });

    if (recentToken) {
      const elapsed = (Date.now() - recentToken.createdAt.getTime()) / 1000;
      if (elapsed < COOLDOWN_SECONDS) {
        throw new ValidationError(
          `再送信は${Math.ceil(COOLDOWN_SECONDS - elapsed)}秒後に可能です`,
        );
      }
    }

    const newToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(
      Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    await tx.emailVerificationToken.create({
      data: {
        token: newToken,
        accountId,
        expiresAt,
      },
    });

    return newToken;
  });

  // メール送信はトランザクション外（外部副作用のため）
  await sendVerificationEmail(email, token);
}

export async function verifyEmailToken(
  token: string,
): Promise<{ success: true }> {
  // 事前チェック（エラーメッセージの出し分け用、ここでは確定しない）
  const record = await prisma.emailVerificationToken.findUnique({
    where: { token },
    include: { account: true },
  });

  if (!record) {
    throw new ValidationError("無効な認証リンクです");
  }

  if (record.usedAt) {
    throw new ValidationError("この認証リンクは既に使用されています");
  }

  if (record.expiresAt < new Date()) {
    throw new ValidationError("認証リンクの有効期限が切れています");
  }

  // TOCTOU防止: トランザクション内で usedAt: null 条件付き更新を原子的に実行
  // 同時リクエストが両方 usedAt チェックを通過しても、
  // updateMany の条件で1つだけが成功する
  await prisma.$transaction(async (tx) => {
    const updated = await tx.emailVerificationToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    if (updated.count === 0) {
      throw new ValidationError("この認証リンクは既に使用されています");
    }

    await tx.account.update({
      where: { id: record.accountId },
      data: { emailVerified: true },
    });
  });

  return { success: true };
}
