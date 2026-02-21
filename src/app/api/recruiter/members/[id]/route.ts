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

    // TOCTOU防止: ステータス条件付き更新で同時リクエストを防ぐ
    const result = await prisma.recruiter.updateMany({
      where: { id: target.id, companyId: company.id, status: target.status },
      data: { status: body.status },
    });

    if (result.count === 0) {
      throw new ConflictError(
        "メンバーのステータスが変更されたため、処理を完了できません",
      );
    }

    return NextResponse.json(
      { id: target.id, status: body.status },
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
    // TOCTOU防止: ステータス条件付き更新で同時リクエストを防ぐ
    const result = await prisma.recruiter.updateMany({
      where: {
        id: target.id,
        companyId: company.id,
        status: { not: "DISABLED" },
      },
      data: { status: "DISABLED" },
    });

    if (result.count === 0) {
      throw new ConflictError(
        "メンバーは既に無効化されているか、ステータスが変更されました",
      );
    }

    return NextResponse.json(
      { id: target.id, status: "DISABLED" },
      { status: 200 },
    );
  },
);
