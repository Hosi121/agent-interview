import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "healthy" }, { status: 200 });
  } catch {
    return NextResponse.json({ status: "unhealthy" }, { status: 503 });
  }
}
