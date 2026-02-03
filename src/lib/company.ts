import { randomBytes } from "node:crypto";
import type { Company, CompanyRole, Recruiter } from "@prisma/client";
import { ConflictError, ForbiddenError, NotFoundError } from "./errors";
import { prisma } from "./prisma";

function slugifyName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const fallback = `company-${randomBytes(4).toString("hex")}`;
  return base || fallback;
}

export async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugifyName(name);
  let candidate = base;
  let counter = 1;

  while (true) {
    const exists = await prisma.company.findUnique({
      where: { slug: candidate },
    });
    if (!exists) return candidate;
    candidate = `${base}-${counter++}`;
  }
}

export async function getRecruiterWithCompany(recruiterId: string): Promise<{
  company: Company;
  recruiter: Recruiter;
}> {
  const recruiter = await prisma.recruiter.findUnique({
    where: { id: recruiterId },
    include: { company: true },
  });

  if (!recruiter) {
    throw new NotFoundError("採用担当者が見つかりません");
  }

  if (recruiter.status !== "ACTIVE") {
    throw new ForbiddenError("会社へのアクセス権が無効です");
  }

  return { company: recruiter.company, recruiter };
}

export function canManageMembers(role: CompanyRole) {
  return role === "OWNER" || role === "ADMIN";
}

/**
 * 新しい会社を作成し、作成者をOWNERとして登録
 * 既存のRecruiterがいない場合は新規作成
 */
export async function createCompanyWithOwner(
  accountId: string,
  companyName: string,
): Promise<{ company: Company; recruiter: Recruiter }> {
  // アカウントを確認
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: { recruiter: true },
  });

  if (!account) {
    throw new NotFoundError("アカウントが見つかりません");
  }

  if (account.accountType !== "RECRUITER") {
    throw new ForbiddenError("採用担当者アカウントのみが会社を作成できます");
  }

  // 既にRecruiterが存在し、会社に所属している場合はエラー
  if (account.recruiter) {
    throw new ConflictError("既に会社に所属しています");
  }

  const slug = await generateUniqueSlug(companyName);

  // トランザクションで会社とRecruiterを作成
  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: companyName,
        slug,
        createdByAccountId: accountId,
      },
    });

    const recruiter = await tx.recruiter.create({
      data: {
        accountId,
        companyId: company.id,
        role: "OWNER",
        status: "ACTIVE",
        joinedAt: new Date(),
      },
    });

    return { company, recruiter };
  });

  return result;
}

/**
 * 既存のRecruiterを会社に紐づけ（初回セットアップ用）
 * companyIdがない既存Recruiter向け
 */
export async function setupCompanyForRecruiter(
  recruiterId: string,
  companyName: string,
): Promise<{ company: Company; recruiter: Recruiter }> {
  const recruiter = await prisma.recruiter.findUnique({
    where: { id: recruiterId },
    include: { account: true },
  });

  if (!recruiter) {
    throw new NotFoundError("採用担当者が見つかりません");
  }

  const slug = await generateUniqueSlug(companyName);

  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: companyName,
        slug,
        createdByAccountId: recruiter.accountId,
      },
    });

    const updatedRecruiter = await tx.recruiter.update({
      where: { id: recruiterId },
      data: {
        companyId: company.id,
        role: "OWNER",
        status: "ACTIVE",
        joinedAt: new Date(),
      },
    });

    return { company, recruiter: updatedRecruiter };
  });

  return result;
}
