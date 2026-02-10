import { NextResponse } from "next/server";
import { withRecruiterAuth, withRecruiterValidation } from "@/lib/api-utils";
import { canManageMembers, getRecruiterWithCompany } from "@/lib/company";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { memberUpdateSchema } from "@/lib/validations";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const PATCH = withRecruiterValidation(
  memberUpdateSchema,
  async (body, _req, session, context: RouteContext) => {
    if (!session.user.recruiterId || !session.user.accountId) {
      throw new ForbiddenError("採用担当者のみが利用できます");
    }

    const { company, recruiter } = await getRecruiterWithCompany(
      session.user.recruiterId,
    );

    if (!canManageMembers(recruiter.role)) {
      throw new ForbiddenError("メンバーを更新する権限がありません");
    }

    const params = await context.params;
    if (!params?.id) {
      throw new NotFoundError("メンバーが見つかりません");
    }

    const target = await prisma.recruiter.findFirst({
      where: { id: params.id, companyId: company.id },
      include: { account: true },
    });

    if (!target) {
      throw new NotFoundError("メンバーが見つかりません");
    }

    if (target.accountId === session.user.accountId) {
      throw new ConflictError("自分自身のステータスは変更できません");
    }

    if (target.role === "OWNER" && recruiter.role !== "OWNER") {
      throw new ForbiddenError("オーナーのステータスは変更できません");
    }

    if (target.status === body.status) {
      return NextResponse.json(
        { id: target.id, status: target.status },
        { status: 200 },
      );
    }

    const updated = await prisma.recruiter.update({
      where: { id: target.id },
      data: { status: body.status },
    });

    return NextResponse.json(
      { id: updated.id, status: updated.status },
      { status: 200 },
    );
  },
);

export const DELETE = withRecruiterAuth<RouteContext>(
  async (_req, session, context) => {
    if (!session.user.recruiterId || !session.user.accountId) {
      throw new ForbiddenError("採用担当者のみが利用できます");
    }

    const { company, recruiter } = await getRecruiterWithCompany(
      session.user.recruiterId,
    );

    if (!canManageMembers(recruiter.role)) {
      throw new ForbiddenError("メンバーを削除する権限がありません");
    }

    const params = await context.params;
    if (!params?.id) {
      throw new NotFoundError("メンバーが見つかりません");
    }

    const target = await prisma.recruiter.findFirst({
      where: { id: params.id, companyId: company.id },
      include: { account: true },
    });

    if (!target) {
      throw new NotFoundError("メンバーが見つかりません");
    }

    if (target.accountId === session.user.accountId) {
      throw new ConflictError("自分自身は削除できません");
    }

    if (target.role === "OWNER" && recruiter.role !== "OWNER") {
      throw new ForbiddenError("オーナーは削除できません");
    }

    // メンバーをソフトデリート（DISABLEDに変更）
    // 関連データを保持しつつアクセスを無効化
    const updated = await prisma.recruiter.update({
      where: { id: target.id },
      data: { status: "DISABLED" },
    });

    return NextResponse.json(
      { id: updated.id, status: "DISABLED" },
      { status: 200 },
    );
  },
);
