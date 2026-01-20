import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { AccountType } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name, companyName, accountType } = body;

    if (!email || !password || !name || !accountType) {
      return NextResponse.json(
        { error: "必須項目が不足しています" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "パスワードは6文字以上で入力してください" },
        { status: 400 }
      );
    }

    if (accountType === "RECRUITER" && !companyName) {
      return NextResponse.json(
        { error: "会社名は必須です" },
        { status: 400 }
      );
    }

    const existingAccount = await prisma.account.findUnique({
      where: { email },
    });

    if (existingAccount) {
      return NextResponse.json(
        { error: "このメールアドレスは既に登録されています" },
        { status: 400 }
      );
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
                  companyName,
                },
              },
            }),
      },
      include: {
        user: true,
        recruiter: true,
      },
    });

    return NextResponse.json({ account });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "登録に失敗しました" },
      { status: 500 }
    );
  }
}
