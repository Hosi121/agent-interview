import { NextResponse } from "next/server";
import { withRecruiterValidation } from "@/lib/api-utils";
import { canManageMembers, getRecruiterWithCompany } from "@/lib/company";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { inviteUpdateSchema } from "@/lib/validations";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const PATCH = withRecruiterValidation(
  inviteUpdateSchema,
  async (body, _req, session, context: RouteContext) => {
    if (!session.user.recruiterId) {
      throw new ForbiddenError("採用担当者のみが利用できます");
    }

    const { company, recruiter } = await getRecruiterWithCompany(
      session.user.recruiterId,
    );

    if (!canManageMembers(recruiter.role)) {
      throw new ForbiddenError("招待を更新する権限がありません");
    }

    const params = await context.params;
    if (!params?.id) {
      throw new NotFoundError("招待が見つかりません");
    }

    const invite = await prisma.invite.findFirst({
      where: { id: params.id, companyId: company.id },
    });

    if (!invite) {
      throw new NotFoundError("招待が見つかりません");
    }

    if (invite.status !== "PENDING") {
      throw new ConflictError("この招待はキャンセルできません");
    }

    // TOCTOU防止: ステータス条件付き更新で同時リクエストを防ぐ
    const result = await prisma.invite.updateMany({
      where: { id: invite.id, status: "PENDING" },
      data: { status: body.status },
    });

    if (result.count === 0) {
      throw new ConflictError(
        "招待のステータスが変更されたため、処理を完了できません",
      );
    }

    return NextResponse.json(
      { id: invite.id, status: body.status },
      { status: 200 },
    );
  },
);
