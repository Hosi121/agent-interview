import { FragmentType, SourceType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api-utils";
import { ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const validFragmentTypes = Object.values(FragmentType) as [string, ...string[]];

const fragmentSchema = z.object({
  type: z.string().max(50),
  content: z.string().min(1).max(10000),
  skills: z.array(z.string().max(200)).max(50).default([]),
  keywords: z.array(z.string().max(200)).max(50).default([]),
});

const callbackSchema = z
  .object({
    documentId: z.string().uuid(),
    userId: z.string().uuid(),
    fragments: z.array(fragmentSchema).max(500).optional(),
    summary: z.string().max(5000).optional(),
    error: z.string().max(5000).optional(),
  })
  .strict();

export const POST = withErrorHandling(async (req) => {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.ANALYSIS_CALLBACK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = callbackSchema.safeParse(body);
  if (!parsed.success) {
    logger.warn("Analysis callback validation failed", {
      errors: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
    throw new ValidationError("リクエストの形式が不正です", {
      fields: Object.fromEntries(
        parsed.error.issues.map((i) => [i.path.join("."), [i.message]]),
      ),
    });
  }

  const { documentId, userId, fragments, summary, error } = parsed.data;

  if (error) {
    await prisma.document.update({
      where: { id: documentId },
      data: { analysisStatus: "FAILED", analysisError: error },
    });

    logger.info("Document analysis failed (callback)", {
      documentId,
      userId,
      error,
    });

    return NextResponse.json({ success: true, status: "FAILED" });
  }

  const fragmentData = (fragments || []).map((fragment) => {
    const fragmentType = validFragmentTypes.includes(fragment.type)
      ? (fragment.type as FragmentType)
      : FragmentType.FACT;

    return {
      userId,
      type: fragmentType,
      content: fragment.content,
      skills: fragment.skills,
      keywords: fragment.keywords,
      sourceType: SourceType.DOCUMENT as SourceType,
      sourceId: documentId,
    };
  });

  let fragmentsCount = 0;
  if (fragmentData.length > 0) {
    const created = await prisma.fragment.createMany({ data: fragmentData });
    fragmentsCount = created.count;
  }

  const resultSummary =
    summary ||
    (fragmentsCount > 0
      ? `${fragmentsCount}件の記憶のかけらを抽出しました`
      : "記憶のかけらが見つかりませんでした");

  await prisma.document.update({
    where: { id: documentId },
    data: {
      summary: resultSummary,
      analysisStatus: "COMPLETED",
      analyzedAt: new Date(),
    },
  });

  logger.info("Document analysis completed (callback)", {
    documentId,
    userId,
    fragmentsCount,
  });

  return NextResponse.json({
    success: true,
    status: "COMPLETED",
    fragmentsCount,
  });
});
