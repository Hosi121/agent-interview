import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthValidation } from "@/lib/api-utils";
import { createCompanyWithOwner, setupCompanyForRecruiter } from "@/lib/company";
import { ForbiddenError } from "@/lib/errors";

const createCompanySchema = z.object({
  name: z
    .string()
    .min(1, "会社名は必須です")
    .max(100, "会社名は100文字以内で入力してください"),
});

// 会社を新規作成（初回セットアップ用）
export const POST = withAuthValidation(
  createCompanySchema,
  async (body, req, session) => {
    if (session.user.accountType !== "RECRUITER") {
      throw new ForbiddenError("採用担当者のみが会社を作成できます");
    }

    if (!session.user.accountId) {
      throw new ForbiddenError("アカウント情報が取得できません");
    }

    // 既に会社に所属している場合はエラー
    if (session.user.companyId) {
      throw new ForbiddenError("既に会社に所属しています");
    }

    const { company, recruiter } = session.user.recruiterId
      ? await setupCompanyForRecruiter(session.user.recruiterId, body.name)
      : await createCompanyWithOwner(session.user.accountId, body.name);

    return NextResponse.json(
      {
        company: {
          id: company.id,
          name: company.name,
          slug: company.slug,
        },
        recruiter: {
          id: recruiter.id,
          role: recruiter.role,
        },
      },
      { status: 201 },
    );
  },
);
