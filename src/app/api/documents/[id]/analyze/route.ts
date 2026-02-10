import { FragmentType, SourceType } from "@prisma/client";
import { NextResponse } from "next/server";
import { withUserAuth } from "@/lib/api-utils";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { getFileBuffer } from "@/lib/minio";
import { extractFragments, extractTextFromPdfWithVision } from "@/lib/openai";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export const POST = withUserAuth<RouteContext>(
  async (req, session, context) => {
    const { id } = await context.params;

    const document = await prisma.document.findFirst({
      where: {
        id,
        userId: session.user.userId,
      },
    });

    if (!document) {
      throw new NotFoundError("ドキュメントが見つかりません");
    }

    const fileBuffer = await getFileBuffer(document.filePath);
    let textContent = "";

    if (document.fileName.toLowerCase().endsWith(".pdf")) {
      // GPT-4o VisionでOCR処理（スキャンPDFにも対応）
      textContent = await extractTextFromPdfWithVision(fileBuffer);
    } else if (
      document.fileName.toLowerCase().endsWith(".txt") ||
      document.fileName.toLowerCase().endsWith(".md")
    ) {
      textContent = fileBuffer.toString("utf-8");
    } else if (document.fileName.toLowerCase().endsWith(".docx")) {
      // Word(docx)をプレーンテキストに変換（動的インポートでサーバーのみ読み込み）
      const mammothModule = await import("mammoth");
      const mammoth = mammothModule.default || mammothModule;
      const { value } = await mammoth.extractRawText({ buffer: fileBuffer });
      textContent = value || "";
    } else {
      textContent = fileBuffer.toString("utf-8");
    }

    if (!textContent.trim()) {
      throw new ValidationError(
        "ドキュメントからテキストを抽出できませんでした",
      );
    }

    const truncatedContent = textContent.slice(0, 10000);

    const result = await extractFragments(truncatedContent);

    const validFragmentTypes = Object.values(FragmentType);
    const createdFragments = [];

    for (const fragment of result.fragments || []) {
      const fragmentType = validFragmentTypes.includes(
        fragment.type as FragmentType,
      )
        ? (fragment.type as FragmentType)
        : FragmentType.FACT;

      const created = await prisma.fragment.create({
        data: {
          userId: session.user.userId,
          type: fragmentType,
          content: fragment.content,
          skills: fragment.skills || [],
          keywords: fragment.keywords || [],
          sourceType: SourceType.DOCUMENT,
          sourceId: document.id,
        },
      });
      createdFragments.push(created);
    }

    const summary =
      createdFragments.length > 0
        ? `${createdFragments.length}件の記憶のかけらを抽出しました`
        : "記憶のかけらが見つかりませんでした";

    await prisma.document.update({
      where: { id: document.id },
      data: { summary },
    });

    return NextResponse.json({
      success: true,
      fragmentsCount: createdFragments.length,
      summary,
    });
  },
);
