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

export const CHUNK_SIZE = 8000;
export const CHUNK_OVERLAP = 500;
const MAX_EXISTING_FRAGMENTS = 50;

/**
 * 指定位置より手前で最も近い自然な区切り（改行・句点）を探す。
 * 見つからなければ元の位置をそのまま返す。
 */
export function findNaturalBreak(
  text: string,
  position: number,
  searchRange: number = CHUNK_OVERLAP,
): number {
  const searchStart = Math.max(position - searchRange, 0);
  const segment = text.slice(searchStart, position);

  const lastNewline = segment.lastIndexOf("\n");
  if (lastNewline !== -1) return searchStart + lastNewline + 1;

  const lastPeriod = segment.lastIndexOf("。");
  if (lastPeriod !== -1) return searchStart + lastPeriod + 1;

  return position;
}

/**
 * テキストをチャンクに分割する。
 * 改行や句点の位置で区切りを調整し、文脈の断絶を最小化する。
 */
export function splitTextIntoChunks(
  text: string,
  chunkSize: number,
  overlap: number,
): string[] {
  if (overlap >= chunkSize) {
    throw new Error("overlap must be less than chunkSize");
  }

  if (text.length <= chunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);
    if (end < text.length) {
      end = findNaturalBreak(text, end, overlap);
      // findNaturalBreak が start 以前の位置を返した場合、強制的に進める
      if (end <= start) {
        end = start + chunkSize;
      }
    }
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

/**
 * ドキュメントを解析し、Fragment を抽出する（DB 非依存）。
 * Lambda から直接呼び出される。
 * 大きなドキュメントはチャンク分割して順次処理し、重複排除しながらマージする。
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

  const chunks = splitTextIntoChunks(textContent, CHUNK_SIZE, CHUNK_OVERLAP);
  const allFragments: ProcessedFragment[] = [];

  for (const [i, chunk] of chunks.entries()) {
    try {
      const recentFragments = allFragments.slice(-MAX_EXISTING_FRAGMENTS);
      const result = await extractFragments(
        chunk,
        recentFragments.length > 0
          ? {
              existingFragments: recentFragments.map((f) => ({
                type: f.type,
                content: f.content,
              })),
            }
          : undefined,
      );

      for (const fragment of result.fragments || []) {
        allFragments.push({
          type: fragment.type,
          content: fragment.content,
          skills: fragment.skills || [],
          keywords: fragment.keywords || [],
        });
      }
    } catch (error) {
      console.warn(
        `チャンク ${i + 1}/${chunks.length} の処理に失敗しました:`,
        error,
      );
      if (allFragments.length === 0 && i === chunks.length - 1) {
        throw error;
      }
    }
  }

  const summary =
    allFragments.length > 0
      ? `${allFragments.length}件の記憶のかけらを抽出しました`
      : "記憶のかけらが見つかりませんでした";

  return { fragments: allFragments, summary };
}
