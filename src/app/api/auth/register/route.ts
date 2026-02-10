import type { AccountType } from "@prisma/client";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withValidation } from "@/lib/api-utils";
import { generateUniqueSlug } from "@/lib/company";
import { ConflictError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

const registerSchema = z
  .object({
    email: z.string().email("有効なメールアドレスを入力してください"),
    password: z.string().min(6, "パスワードは6文字以上で入力してください"),
    name: z.string().min(1, "名前は必須です"),
    accountType: z.enum(["USER", "RECRUITER"], {
      message: "アカウントタイプはUSERまたはRECRUITERを指定してください",
    }),
    companyName: z.string().optional(),
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

export const POST = withValidation(registerSchema, async (body, req) => {
  const { email, password, name, accountType, companyName } = body;

  const existingAccount = await prisma.account.findUnique({
    where: { email },
  });

  if (existingAccount) {
    throw new ConflictError("このメールアドレスは既に登録されています");
  }

  const passwordHash = await hash(password, 12);

  if (accountType === "RECRUITER") {
    // 採用担当者 + 会社を同時作成
    const validatedCompanyName = companyName as string;
    const slug = await generateUniqueSlug(validatedCompanyName);

    const result = await prisma.$transaction(async (tx) => {
      // アカウント作成
      const account = await tx.account.create({
        data: {
          email,
          passwordHash,
          accountType: accountType as AccountType,
        },
      });

      // 会社作成
      const company = await tx.company.create({
        data: {
          name: validatedCompanyName,
          slug,
          createdByAccountId: account.id,
        },
      });

      // Recruiter作成（OWNERとして）
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
      },
      { status: 201 },
    );
  }

  // 求職者登録
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

  return NextResponse.json({ account }, { status: 201 });
});
