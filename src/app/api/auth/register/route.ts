import type { AccountType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withRateLimitValidation } from "@/lib/api-utils";
import { generateUniqueSlug } from "@/lib/company";
import { ConflictError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { RATE_LIMIT_PRESETS } from "@/lib/rate-limiter";
import { createAndSendVerificationToken } from "@/lib/verification";

const registerSchema = z
  .object({
    email: z.string().email("有効なメールアドレスを入力してください"),
    password: z
      .string()
      .min(6, "パスワードは6文字以上で入力してください")
      .max(100, "パスワードは100文字以下で入力してください"),
    name: z.string().min(1, "名前は必須です").max(100),
    accountType: z.enum(["USER", "RECRUITER"], {
      message: "アカウントタイプはUSERまたはRECRUITERを指定してください",
    }),
    companyName: z.string().max(200).optional(),
  })
  .refine(
    (data) => {
      if (data.accountType === "RECRUITER") {
        return data.companyName && data.companyName.trim().length > 0;
      }
      return true;
    },
    {
      message: "採用担当者の登録には会社名が必須です",
      path: ["companyName"],
    },
  );

/**
 * Prismaのユニーク制約違反を判定
 */
function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/**
 * アカウント作成後に認証メールを送信（失敗しても登録は成功扱い）
 */
async function sendVerificationSafely(
  accountId: string,
  email: string,
): Promise<void> {
  try {
    await createAndSendVerificationToken(accountId, email);
  } catch (error) {
    logger.error(
      "Failed to send verification email after registration",
      error instanceof Error ? error : new Error(String(error)),
      { accountId, email },
    );
  }
}

export const POST = withRateLimitValidation(
  RATE_LIMIT_PRESETS.REGISTER,
  registerSchema,
  async (body) => {
    const { email, password, name, accountType, companyName } = body;

    const existingAccount = await prisma.account.findUnique({
      where: { email },
    });

    if (existingAccount) {
      throw new ConflictError("このメールアドレスは既に登録されています");
    }

    const passwordHash = await hash(password, 12);

    try {
      if (accountType === "RECRUITER") {
        return await registerRecruiter(
          email,
          passwordHash,
          accountType,
          companyName as string,
        );
      }

      return await registerUser(email, passwordHash, accountType, name);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError("このメールアドレスは既に登録されています");
      }
      throw error;
    }
  },
);

async function registerRecruiter(
  email: string,
  passwordHash: string,
  accountType: string,
  companyName: string,
): Promise<NextResponse> {
  const slug = await generateUniqueSlug(companyName);

  const result = await prisma.$transaction(async (tx) => {
    const account = await tx.account.create({
      data: {
        email,
        passwordHash,
        accountType: accountType as AccountType,
      },
    });

    const company = await tx.company.create({
      data: {
        name: companyName,
        slug,
        createdByAccountId: account.id,
      },
    });

    const recruiter = await tx.recruiter.create({
      data: {
        accountId: account.id,
        companyId: company.id,
        role: "OWNER",
        status: "ACTIVE",
        joinedAt: new Date(),
      },
    });

    return { account, company, recruiter };
  });

  await sendVerificationSafely(result.account.id, email);

  return NextResponse.json(
    {
      account: {
        id: result.account.id,
        email: result.account.email,
        accountType: result.account.accountType,
      },
      company: {
        id: result.company.id,
        name: result.company.name,
        slug: result.company.slug,
      },
      recruiter: {
        id: result.recruiter.id,
        role: result.recruiter.role,
      },
      requiresVerification: true,
    },
    { status: 201 },
  );
}

async function registerUser(
  email: string,
  passwordHash: string,
  accountType: string,
  name: string,
): Promise<NextResponse> {
  const account = await prisma.account.create({
    data: {
      email,
      passwordHash,
      accountType: accountType as AccountType,
      user: {
        create: { name },
      },
    },
    include: {
      user: true,
    },
  });

  await sendVerificationSafely(account.id, email);

  return NextResponse.json(
    {
      account: {
        id: account.id,
        email: account.email,
        accountType: account.accountType,
      },
      requiresVerification: true,
    },
    { status: 201 },
  );
}
