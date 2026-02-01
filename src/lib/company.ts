import type { Company, CompanyMember, CompanyRole } from "@prisma/client";
import { randomBytes } from "crypto";
import { ForbiddenError, NotFoundError } from "./errors";
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

async function generateUniqueSlug(name: string): Promise<string> {
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

export async function ensureCompanyForRecruiter(recruiterId: string): Promise<{
  company: Company;
  membership: CompanyMember;
}> {
  const recruiter = await prisma.recruiter.findUnique({
    where: { id: recruiterId },
    include: { account: true, company: true },
  });

  if (!recruiter) {
    throw new NotFoundError("採用担当者が見つかりません");
  }

  let company = recruiter.company;
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: recruiter.companyName,
        slug: await generateUniqueSlug(recruiter.companyName),
        createdByAccountId: recruiter.accountId,
      },
    });
    await prisma.recruiter.update({
      where: { id: recruiter.id },
      data: { companyId: company.id },
    });
  }

  let membership = await prisma.companyMember.findFirst({
    where: { companyId: company.id, accountId: recruiter.accountId },
  });

  if (!membership) {
    membership = await prisma.companyMember.create({
      data: {
        companyId: company.id,
        accountId: recruiter.accountId,
        role: "OWNER",
        status: "ACTIVE",
        invitedByAccountId: recruiter.accountId,
        joinedAt: new Date(),
      },
    });
  }

  if (membership.status !== "ACTIVE") {
    throw new ForbiddenError("会社へのアクセス権が無効です");
  }

  return { company, membership };
}

export function canManageMembers(role: CompanyRole) {
  return role === "OWNER" || role === "ADMIN";
}
