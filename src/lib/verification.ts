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
  // 60秒クールダウンチェック
  const recentToken = await prisma.emailVerificationToken.findFirst({
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

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await prisma.emailVerificationToken.create({
    data: {
      token,
      accountId,
      expiresAt,
    },
  });

  await sendVerificationEmail(email, token);
}

export async function verifyEmailToken(
  token: string,
): Promise<{ success: true }> {
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

  await prisma.$transaction([
    prisma.account.update({
      where: { id: record.accountId },
      data: { emailVerified: true },
    }),
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { success: true };
}
