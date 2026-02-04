import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { withAuthValidation } from "@/lib/api-utils";
import { canManageMembers, getRecruiterWithCompany } from "@/lib/company";
import { ConflictError, ForbiddenError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { inviteCreateSchema } from "@/lib/validations";

export const POST = withAuthValidation(
  inviteCreateSchema,
  async (body, req, session) => {
    if (
      session.user.accountType !== "RECRUITER" ||
      !session.user.recruiterId ||
      !session.user.accountId
    ) {
      throw new ForbiddenError("採用担当者のみが利用できます");
    }

    const { company, recruiter } = await getRecruiterWithCompany(
      session.user.recruiterId,
    );

    if (!canManageMembers(recruiter.role)) {
      throw new ForbiddenError("招待を作成する権限がありません");
    }

    const existingMember = await prisma.recruiter.findFirst({
      where: {
        companyId: company.id,
        account: { email: body.email },
        status: "ACTIVE",
      },
    });

    if (existingMember) {
      throw new ConflictError(
        "このメールアドレスは既にメンバーとして登録されています",
      );
    }

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7日

    const invite = await prisma.invite.create({
      data: {
        token,
        companyId: company.id,
        email: body.email,
        role: body.role,
        expiresAt,
        invitedByAccountId: session.user.accountId,
      },
    });

    return NextResponse.json(
      {
        invite,
        acceptUrl: `${baseUrl}/invite/${invite.token}`,
      },
      { status: 201 },
    );
  },
);
