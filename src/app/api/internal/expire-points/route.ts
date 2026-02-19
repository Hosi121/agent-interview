import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { expirePointsBatch } from "@/lib/points";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscriptions = await prisma.subscription.findMany({
    where: { status: "ACTIVE" },
    select: { companyId: true },
  });

  const results: Array<{ companyId: string; expired: number }> = [];

  for (const sub of subscriptions) {
    try {
      const { expired } = await expirePointsBatch(sub.companyId);
      if (expired > 0) {
        results.push({ companyId: sub.companyId, expired });
      }
    } catch (err) {
      logger.error("Failed to expire points", err as Error, {
        companyId: sub.companyId,
      });
    }
  }

  logger.info("Batch point expiration completed", {
    processed: subscriptions.length,
    expiredCount: results.length,
  });

  return NextResponse.json({ processed: subscriptions.length, results });
}
