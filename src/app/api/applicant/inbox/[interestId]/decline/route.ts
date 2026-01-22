import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ interestId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { interestId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const preference =
      body.preference === "DENY" ? "DENY" : ("NONE" as const);

    const interest = await prisma.interest.findUnique({
      where: { id: interestId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        recruiter: {
          select: {
            id: true,
            companyName: true,
            accountId: true,
          },
        },
      },
    });

    if (!interest) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (interest.userId !== session.user.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (interest.status === "CONTACT_DISCLOSED") {
      return NextResponse.json(
        { error: "既に連絡先が開示されています" },
        { status: 409 },
      );
    }

    if (interest.status !== "DECLINED") {
      await prisma.interest.update({
        where: { id: interestId },
        data: { status: "DECLINED" },
      });
    }

    if (preference === "DENY") {
      await prisma.companyAccess.upsert({
        where: {
          userId_recruiterId: {
            userId: interest.userId,
            recruiterId: interest.recruiterId,
          },
        },
        create: {
          userId: interest.userId,
          recruiterId: interest.recruiterId,
          status: "DENY",
        },
        update: { status: "DENY" },
      });
    }

    await prisma.notification.create({
      data: {
        accountId: interest.recruiter.accountId,
        type: "SYSTEM",
        title: "連絡先開示が辞退されました",
        body: `${interest.user.name}が連絡先開示を辞退しました`,
        data: {
          interestId,
          recruiterId: interest.recruiterId,
          userId: interest.userId,
        },
      },
    });

    return NextResponse.json({ status: "DECLINED" });
  } catch (error) {
    console.error("Decline contact disclosure error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
