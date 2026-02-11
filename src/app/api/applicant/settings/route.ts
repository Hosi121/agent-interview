import { NextResponse } from "next/server";
import { z } from "zod";
import { withUserAuth } from "@/lib/api-utils";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { getFileUrl } from "@/lib/minio";
import { prisma } from "@/lib/prisma";

// 連絡先設定を取得
export const GET = withUserAuth(async (req, session) => {
  const user = await prisma.user.findUnique({
    where: { id: session.user.userId },
    select: {
      name: true,
      email: true,
      phone: true,
      avatarPath: true,
    },
  });

  if (!user) {
    throw new NotFoundError("ユーザーが見つかりません");
  }

  const avatarUrl = user.avatarPath ? await getFileUrl(user.avatarPath) : null;

  return NextResponse.json({
    settings: {
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatarUrl,
    },
  });
});

const updateSettingsSchema = z.object({
  name: z.string().min(1, "名前を入力してください").optional(),
  email: z
    .string()
    .email("メールアドレスの形式が不正です")
    .optional()
    .nullable()
    .or(z.literal("")),
  phone: z
    .string()
    .regex(/^[\d\-+().\s]*$/, "電話番号の形式が不正です")
    .optional()
    .nullable()
    .or(z.literal("")),
});

// 連絡先設定を更新
export const PATCH = withUserAuth(async (req, session) => {
  const rawBody = await req.json();
  const parsed = updateSettingsSchema.safeParse(rawBody);

  if (!parsed.success) {
    throw new ValidationError("入力内容に問題があります", {
      fields: parsed.error.flatten().fieldErrors,
    });
  }

  const { name, email, phone } = parsed.data;

  const updateData: {
    name?: string;
    email?: string | null;
    phone?: string | null;
  } = {};
  if (name !== undefined) updateData.name = name.trim();
  if (email !== undefined) updateData.email = email === "" ? null : email;
  if (phone !== undefined) updateData.phone = phone === "" ? null : phone;

  const updatedUser = await prisma.user.update({
    where: { id: session.user.userId },
    data: updateData,
    select: {
      name: true,
      email: true,
      phone: true,
    },
  });

  return NextResponse.json({
    settings: {
      name: updatedUser.name,
      email: updatedUser.email,
      phone: updatedUser.phone,
    },
  });
});
