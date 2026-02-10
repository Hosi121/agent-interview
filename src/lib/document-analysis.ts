import { FragmentType, SourceType } from "@prisma/client";
import { logger } from "./logger";
import { getFileBuffer } from "./minio";
import { extractFragments, extractTextFromPdfWithVision } from "./openai";
import { prisma } from "./prisma";

/**
 * ドキュメントを解析し、Fragment を抽出・保存する。
 * Next.js 依存なし — Lambda / API route 両方から呼び出し可能。
 * 呼び出し元が事前に analysisStatus を ANALYZING にセットしていることを前提とする。
 */
export async function analyzeDocument(
  documentId: string,
  userId: string,
): Promise<{ fragmentsCount: number; summary: string }> {
  const document = await prisma.document.findFirst({
    where: { id: documentId, userId },
  });

  if (!document) {
    throw new Error("ドキュメントが見つかりません");
  }

  const fileBuffer = await getFileBuffer(document.filePath);
  let textContent = "";

  if (document.fileName.toLowerCase().endsWith(".pdf")) {
    textContent = await extractTextFromPdfWithVision(fileBuffer);
  } else if (
    document.fileName.toLowerCase().endsWith(".txt") ||
    document.fileName.toLowerCase().endsWith(".md")
  ) {
    textContent = fileBuffer.toString("utf-8");
  } else if (document.fileName.toLowerCase().endsWith(".docx")) {
    const mammothModule = await import("mammoth");
    const mammoth = mammothModule.default || mammothModule;
    const { value } = await mammoth.extractRawText({ buffer: fileBuffer });
    textContent = value || "";
  } else {
    textContent = fileBuffer.toString("utf-8");
  }

  if (!textContent.trim()) {
    throw new Error("ドキュメントからテキストを抽出できませんでした");
  }

  const truncatedContent = textContent.slice(0, 10000);
  const result = await extractFragments(truncatedContent);

  const validFragmentTypes = Object.values(FragmentType);

  const fragmentData = (result.fragments || []).map((fragment) => {
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
      sourceId: document.id,
    };
  });

  let fragmentsCount = 0;
  if (fragmentData.length > 0) {
    const created = await prisma.fragment.createMany({ data: fragmentData });
    fragmentsCount = created.count;
  }

  const summary =
    fragmentsCount > 0
      ? `${fragmentsCount}件の記憶のかけらを抽出しました`
      : "記憶のかけらが見つかりませんでした";

  await prisma.document.update({
    where: { id: document.id },
    data: {
      summary,
      analysisStatus: "COMPLETED",
      analyzedAt: new Date(),
    },
  });

  logger.info("Document analysis completed", {
    documentId,
    userId,
    fragmentsCount,
  });

  return { fragmentsCount, summary };
}
