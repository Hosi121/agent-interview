import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { withErrorHandling, withValidation } from "@/lib/api-utils";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { inviteAcceptSchema } from "@/lib/validations";

interface RouteContext {
  params: Promise<{ token: string }>;
}

export const GET = withErrorHandling<RouteContext>(async (_req, context) => {
  const params = await context.params;
  if (!params?.token) {
    throw new NotFoundError("招待が見つかりません");
  }

  const invite = await prisma.invite.findUnique({
    where: { token: params.token },
    include: { company: true },
  });

  if (!invite) {
    throw new NotFoundError("招待が見つかりません");
  }

  if (invite.status !== "PENDING") {
    return NextResponse.json(
      { error: "この招待は無効です", status: invite.status },
      { status: 410 },
    );
  }

  if (invite.expiresAt < new Date()) {
    await prisma.invite.update({
      where: { id: invite.id },
      data: { status: "EXPIRED" },
    });
    return NextResponse.json(
      { error: "招待の有効期限が切れています", status: "EXPIRED" },
      { status: 410 },
    );
  }

  return NextResponse.json({
    email: invite.email,
    role: invite.role,
    companyName: invite.company.name,
    expiresAt: invite.expiresAt,
    status: invite.status,
  });
});

export const POST = withValidation(
  inviteAcceptSchema,
  async (body, _req, context: RouteContext) => {
    const params = await context.params;
    if (!params?.token) {
      throw new NotFoundError("招待が見つかりません");
    }

    const invite = await prisma.invite.findUnique({
      where: { token: params.token },
      include: { company: true },
    });

    if (!invite) {
      throw new NotFoundError("招待が見つかりません");
    }

    if (invite.status !== "PENDING") {
      throw new ValidationError("この招待は使用できません", {
        status: invite.status,
      });
    }

    if (invite.expiresAt < new Date()) {
      await prisma.invite.update({
        where: { id: invite.id },
        data: { status: "EXPIRED" },
      });
      throw new ValidationError("招待の有効期限が切れています", {
        status: "EXPIRED",
      });
    }

    const existingAccount = await prisma.account.findUnique({
      where: { email: invite.email },
    });
    if (existingAccount) {
      throw new ConflictError(
        "このメールアドレスは既に使用されています。別のメールを指定してください。",
      );
    }

    const passwordHash = await hash(body.password, 12);

    const account = await prisma.$transaction(async (tx) => {
      const createdAccount = await tx.account.create({
        data: {
          email: invite.email,
          passwordHash,
          accountType: "RECRUITER",
          recruiter: {
            create: {
              companyId: invite.companyId,
              role: invite.role,
              status: "ACTIVE",
              invitedByAccountId: invite.invitedByAccountId,
              joinedAt: new Date(),
            },
          },
        },
      });

      await tx.invite.update({
        where: { id: invite.id },
        data: {
          status: "USED",
          usedAccountId: createdAccount.id,
          usedAt: new Date(),
        },
      });

      return createdAccount;
    });

    return NextResponse.json({ accountId: account.id }, { status: 201 });
  },
);
