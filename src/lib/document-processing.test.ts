import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHUNK_OVERLAP,
  CHUNK_SIZE,
  findNaturalBreak,
  splitTextIntoChunks,
} from "./document-processing";

const mockMinio = vi.hoisted(() => ({
  getFileBuffer: vi.fn(),
}));

const mockOpenai = vi.hoisted(() => ({
  extractFragments: vi.fn(),
  extractTextFromPdfWithVision: vi.fn(),
}));

vi.mock("./minio", () => mockMinio);
vi.mock("./openai", () => mockOpenai);

describe("findNaturalBreak", () => {
  it("改行がある場合、最も近い改行の直後を返す", () => {
    const text = "aaaa\nbbbb\ncccc";
    // position=12, searchRange=10 → segment="aaa\nbbbb\nc" (index 2..12)
    const result = findNaturalBreak(text, 12, 10);
    expect(result).toBe(10); // "bbbb\n" の直後
  });

  it("改行がなく句点がある場合、句点の直後を返す", () => {
    const text = "これはテスト。次の文章です";
    const result = findNaturalBreak(text, 10, 10);
    expect(result).toBe(7); // "。" の直後
  });

  it("改行も句点もない場合、元の位置を返す", () => {
    const text = "abcdefghijklmnop";
    const result = findNaturalBreak(text, 10, 5);
    expect(result).toBe(10);
  });

  it("改行と句点の両方がある場合、改行を優先する", () => {
    const text = "テスト。\nここ";
    // position=6, searchRange=6 → segment="テスト。\nこ"
    const result = findNaturalBreak(text, 6, 6);
    expect(result).toBe(5); // "\n" の直後
  });

  it("searchRange が position より大きい場合、先頭から探索する", () => {
    const text = "ab\ncd";
    const result = findNaturalBreak(text, 4, 100);
    expect(result).toBe(3);
  });
});

describe("splitTextIntoChunks", () => {
  it("chunkSize 以下のテキストはそのまま1チャンクで返す", () => {
    const text = "短いテキスト";
    const result = splitTextIntoChunks(text, 100, 10);
    expect(result).toEqual(["短いテキスト"]);
  });

  it("ちょうど chunkSize と同じ長さのテキストは1チャンクで返す", () => {
    const text = "a".repeat(100);
    const result = splitTextIntoChunks(text, 100, 10);
    expect(result).toEqual([text]);
  });

  it("overlap >= chunkSize の場合エラーを投げる", () => {
    expect(() => splitTextIntoChunks("test", 10, 10)).toThrow(
      "overlap must be less than chunkSize",
    );
    expect(() => splitTextIntoChunks("test", 10, 15)).toThrow(
      "overlap must be less than chunkSize",
    );
  });

  it("改行がない長いテキストでも正しく分割される", () => {
    const text = "a".repeat(250);
    const result = splitTextIntoChunks(text, 100, 20);

    expect(result.length).toBeGreaterThanOrEqual(3);
    // 各チャンクが chunkSize 以下
    for (const chunk of result) {
      expect(chunk.length).toBeLessThanOrEqual(100);
    }
    // 全チャンクの合計長（重複含む）がテキスト長以上
    const totalLen = result.reduce((sum, c) => sum + c.length, 0);
    expect(totalLen).toBeGreaterThanOrEqual(text.length);
  });

  it("改行で自然に分割される", () => {
    // 各行が chunkSize 未満だが合計は超える
    const line = "a".repeat(40);
    const text = `${line}\n${line}\n${line}`;
    // chunkSize=90 → 1チャンク目は最初の2行(82文字)で区切られる
    const result = splitTextIntoChunks(text, 90, 10);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0]).toMatch(/\n$/);
  });

  it("句点で自然に分割される", () => {
    const sentence = "これはテストです。";
    // 9文字 × 12 = 108文字
    const text = sentence.repeat(12);
    const result = splitTextIntoChunks(text, 50, 10);
    expect(result.length).toBeGreaterThanOrEqual(2);
    // 各チャンクが句点で終わっている（最後のチャンク以外）
    for (const chunk of result.slice(0, -1)) {
      expect(chunk).toMatch(/。$/);
    }
  });

  it("無限ループせずに必ず終了する", () => {
    // overlap 境界に区切り文字がない長いテキスト
    const text = "a".repeat(300);
    const result = splitTextIntoChunks(text, 100, 50);
    expect(result.length).toBeGreaterThan(1);
    expect(result.length).toBeLessThan(20);
  });

  it("テキスト全体がカバーされる（情報の欠落がない）", () => {
    const text = "あいうえお\nかきくけこ。さしすせそ\nたちつてとなにぬねの";
    const result = splitTextIntoChunks(text, 10, 3);

    // 各チャンクの先頭・末尾がオーバーラップして全体をカバーしている
    let reconstructed = result[0];
    for (let i = 1; i < result.length; i++) {
      const chunk = result[i];
      // 前のチャンクとの重複部分を見つけて結合
      let overlapLen = 0;
      for (let j = 1; j <= Math.min(reconstructed.length, chunk.length); j++) {
        if (reconstructed.endsWith(chunk.slice(0, j))) {
          overlapLen = j;
        }
      }
      reconstructed += chunk.slice(overlapLen);
    }
    expect(reconstructed).toBe(text);
  });
});

describe("processDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("チャンク途中のエラーでも抽出済みFragmentを返す", async () => {
    const { processDocument } = await import("./document-processing");

    const longText = "テスト文章。".repeat(2000);
    mockMinio.getFileBuffer.mockResolvedValue(Buffer.from(longText, "utf-8"));

    let callCount = 0;
    mockOpenai.extractFragments.mockImplementation(async () => {
      callCount++;
      if (callCount === 2) {
        throw new Error("API error");
      }
      return {
        fragments: [
          {
            type: "FACT",
            content: `チャンク${callCount}の結果`,
            skills: [],
            keywords: [],
          },
        ],
      };
    });

    const result = await processDocument("path/to/file", "test.txt");
    expect(result.fragments.length).toBeGreaterThan(0);
    expect(result.summary).toContain("記憶のかけらを抽出しました");
  });

  it("全チャンクが失敗した場合はエラーを投げる", async () => {
    const { processDocument } = await import("./document-processing");

    // CHUNK_SIZE を超えるが2チャンク程度のテキスト
    const text = "a".repeat(CHUNK_SIZE + CHUNK_OVERLAP + 100);
    mockMinio.getFileBuffer.mockResolvedValue(Buffer.from(text, "utf-8"));

    mockOpenai.extractFragments.mockRejectedValue(new Error("API error"));

    await expect(processDocument("path/to/file", "test.txt")).rejects.toThrow(
      "API error",
    );
  });
});
