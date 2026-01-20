import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ウォッチリスト詳細取得（通知一覧含む）
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.recruiterId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const watch = await prisma.candidateWatch.findFirst({
      where: {
        id,
        recruiterId: session.user.recruiterId,
      },
      include: {
        job: {
          select: { id: true, title: true },
        },
        notifications: {
          include: {
            agent: {
              include: {
                user: {
                  select: {
                    name: true,
                    fragments: {
                      select: { type: true, skills: true },
                      take: 5,
                    },
                  },
                },
              },
            },
          },
          orderBy: [
            { isRead: "asc" },
            { matchScore: "desc" },
            { createdAt: "desc" },
          ],
        },
      },
    });

    if (!watch) {
      return NextResponse.json({ error: "Watch not found" }, { status: 404 });
    }

    return NextResponse.json({ watch });
  } catch (error) {
    console.error("Get watch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ウォッチリスト更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.recruiterId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const existingWatch = await prisma.candidateWatch.findFirst({
      where: {
        id,
        recruiterId: session.user.recruiterId,
      },
    });

    if (!existingWatch) {
      return NextResponse.json({ error: "Watch not found" }, { status: 404 });
    }

    const watch = await prisma.candidateWatch.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.skills && { skills: body.skills }),
        ...(body.keywords && { keywords: body.keywords }),
        ...(body.experienceLevel !== undefined && {
          experienceLevel: body.experienceLevel,
        }),
        ...(body.locationPref !== undefined && {
          locationPref: body.locationPref,
        }),
        ...(body.salaryMin !== undefined && { salaryMin: body.salaryMin }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });

    return NextResponse.json({ watch });
  } catch (error) {
    console.error("Update watch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ウォッチリスト削除
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.recruiterId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existingWatch = await prisma.candidateWatch.findFirst({
      where: {
        id,
        recruiterId: session.user.recruiterId,
      },
    });

    if (!existingWatch) {
      return NextResponse.json({ error: "Watch not found" }, { status: 404 });
    }

    await prisma.candidateWatch.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete watch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
