import { FragmentType, SourceType } from "@prisma/client";
import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-utils";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const POST = withErrorHandling(async (req) => {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.ANALYSIS_CALLBACK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { documentId, userId, fragments, summary, error } = body as {
    documentId: string;
    userId: string;
    fragments?: {
      type: string;
      content: string;
      skills: string[];
      keywords: string[];
    }[];
    summary?: string;
    error?: string;
  };

  if (!documentId || !userId) {
    return NextResponse.json(
      { error: "documentId and userId are required" },
      { status: 400 },
    );
  }

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

  const validFragmentTypes = Object.values(FragmentType);

  const fragmentData = (fragments || []).map((fragment) => {
    const fragmentType = validFragmentTypes.includes(
      fragment.type as FragmentType,
    )
      ? (fragment.type as FragmentType)
      : FragmentType.FACT;

    return {
      userId,
      type: fragmentType,
      content: fragment.content,
      skills: fragment.skills || [],
      keywords: fragment.keywords || [],
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
