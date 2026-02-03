import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { getRecruiterWithCompany } from "@/lib/company";
import { ForbiddenError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(async (_req, session) => {
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

  const members = await prisma.recruiter.findMany({
    where: { companyId: company.id },
    include: {
      account: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const invites = await prisma.invite.findMany({
    where: { companyId: company.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  return NextResponse.json({
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
    },
    myRole: recruiter.role,
    members: members.map((m) => ({
      id: m.id,
      role: m.role,
      status: m.status,
      email: m.account.email,
      companyName: company.name,
      createdAt: m.createdAt,
      joinedAt: m.joinedAt,
    })),
    invites: invites.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      status: inv.status,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
      acceptUrl: `${baseUrl}/invite/${inv.token}`,
    })),
  });
});
