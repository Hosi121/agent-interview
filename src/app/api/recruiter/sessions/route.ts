import { NextResponse } from "next/server";
import { withRecruiterAuth } from "@/lib/api-utils";
import { getRecruiterWithCompany } from "@/lib/company";
import { prisma } from "@/lib/prisma";

export const GET = withRecruiterAuth(async (req, session) => {
  const scope = req.nextUrl.searchParams.get("scope");

  // デフォルト: 自分が実施したセッションのみ。scope=company の場合は会社全体で集計。
  const recruiterFilter = await (async () => {
    if (scope === "company") {
      const { company } = await getRecruiterWithCompany(
        session.user.recruiterId,
      );
      return { recruiter: { companyId: company.id } } as const;
    }
    return { recruiterId: session.user.recruiterId } as const;
  })();

  const sessions = await prisma.session.findMany({
    where: {
      sessionType: "RECRUITER_AGENT_CHAT",
      ...recruiterFilter,
      agent: {
        user: {
          companyAccesses: {
            none: {
              companyId: session.user.companyId,
              status: "DENY",
            },
          },
        },
      },
    },
    include: {
      agent: {
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
      messages: {
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ sessions, totalCount: sessions.length });
});
