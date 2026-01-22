import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isCompanyAccessDenied } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.recruiterId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const agent = await prisma.agentProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (agent.status !== "PUBLIC") {
      return NextResponse.json(
        { error: "Agent is not public" },
        { status: 403 },
      );
    }

    if (await isCompanyAccessDenied(session.user.recruiterId, agent.userId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const fragments = await prisma.fragment.findMany({
      where: { userId: agent.userId },
      select: {
        type: true,
        content: true,
        skills: true,
      },
    });

    return NextResponse.json({
      agent: {
        ...agent,
        fragments,
      },
    });
  } catch (error) {
    console.error("Get agent error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
