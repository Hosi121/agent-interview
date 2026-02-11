import { getFileBuffer } from "./minio";
import { extractFragments, extractTextFromPdfWithVision } from "./openai";

export interface ProcessedFragment {
  type: string;
  content: string;
  skills: string[];
  keywords: string[];
}

export interface ProcessResult {
  fragments: ProcessedFragment[];
  summary: string;
}

/**
 * ドキュメントを解析し、Fragment を抽出する（DB 非依存）。
 * Lambda から直接呼び出される。
 */
export async function processDocument(
  filePath: string,
  fileName: string,
): Promise<ProcessResult> {
  const fileBuffer = await getFileBuffer(filePath);
  let textContent = "";

  if (fileName.toLowerCase().endsWith(".pdf")) {
    textContent = await extractTextFromPdfWithVision(fileBuffer);
  } else if (
    fileName.toLowerCase().endsWith(".txt") ||
    fileName.toLowerCase().endsWith(".md")
  ) {
    textContent = fileBuffer.toString("utf-8");
  } else if (fileName.toLowerCase().endsWith(".docx")) {
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

  const fragments: ProcessedFragment[] = (result.fragments || []).map(
    (fragment) => ({
      type: fragment.type,
      content: fragment.content,
      skills: fragment.skills || [],
      keywords: fragment.keywords || [],
    }),
  );

  const summary =
    fragments.length > 0
      ? `${fragments.length}件の記憶のかけらを抽出しました`
      : "記憶のかけらが見つかりませんでした";

  return { fragments, summary };
}
