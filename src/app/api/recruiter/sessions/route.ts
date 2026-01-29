import { NextResponse } from "next/server";
import { withRecruiterAuth } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export const GET = withRecruiterAuth(async (req, session) => {
  const sessions = await prisma.session.findMany({
    where: {
      recruiterId: session.user.recruiterId,
      sessionType: "RECRUITER_AGENT_CHAT",
      agent: {
        user: {
          companyAccesses: {
            none: {
              recruiterId: session.user.recruiterId,
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

  return NextResponse.json({ sessions });
});
