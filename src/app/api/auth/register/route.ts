import type { AccountType } from "@prisma/client";
import { hash } from "bcryptjs";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withValidation } from "@/lib/api-utils";
import { ConflictError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

const registerSchema = z
  .object({
    email: z.string().email("有効なメールアドレスを入力してください"),
    password: z.string().min(6, "パスワードは6文字以上で入力してください"),
    name: z.string().min(1, "名前は必須です"),
    companyName: z.string().optional(),
    accountType: z.enum(["USER", "RECRUITER"], {
      message: "アカウントタイプはUSERまたはRECRUITERを指定してください",
    }),
  })
  .refine(
    (data) => {
      if (data.accountType === "RECRUITER" && !data.companyName) {
        return false;
      }
      return true;
    },
    {
      message: "会社名は必須です",
      path: ["companyName"],
    },
  );

export const POST = withValidation(registerSchema, async (body, req) => {
  const { email, password, name, companyName, accountType } = body;

  const existingAccount = await prisma.account.findUnique({
    where: { email },
  });

  if (existingAccount) {
    throw new ConflictError("このメールアドレスは既に登録されています");
  }

  const passwordHash = await hash(password, 12);

  const account = await prisma.account.create({
    data: {
      email,
      passwordHash,
      accountType: accountType as AccountType,
      ...(accountType === "USER"
        ? {
            user: {
              create: { name },
            },
          }
        : {
            recruiter: {
              create: {
                companyName: companyName!,
              },
            },
          }),
    },
    include: {
      user: true,
      recruiter: true,
    },
  });

  return NextResponse.json({ account }, { status: 201 });
});
