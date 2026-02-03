import type { Company, CompanyRole, Recruiter } from "@prisma/client";
import { ForbiddenError, NotFoundError } from "./errors";
import { prisma } from "./prisma";

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
