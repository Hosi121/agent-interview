import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Logger モック
const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
vi.mock("@/lib/logger", () => ({ logger: mockLogger }));

// Prisma モック
const mockPrisma = {
  document: { update: vi.fn() },
  fragment: { createMany: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// テスト用定数
const API_SECRET = "test-secret-key";
const DOC_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const USER_ID = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";

function createRequest(body: unknown, apiKey?: string): NextRequest {
  return new NextRequest("http://localhost/api/internal/analysis-callback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/internal/analysis-callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ANALYSIS_CALLBACK_SECRET", API_SECRET);
    mockPrisma.document.update.mockResolvedValue({});
    mockPrisma.fragment.createMany.mockResolvedValue({ count: 0 });
  });

  describe("認証", () => {
    it("x-api-keyがない場合は401を返す", async () => {
      const { POST } = await import(
        "@/app/api/internal/analysis-callback/route"
      );
      const req = createRequest({ documentId: DOC_ID, userId: USER_ID });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("x-api-keyが不正な場合は401を返す", async () => {
      const { POST } = await import(
        "@/app/api/internal/analysis-callback/route"
      );
      const req = createRequest(
        { documentId: DOC_ID, userId: USER_ID },
        "wrong-key",
      );

      const res = await POST(req);
      expect(res.status).toBe(401);
    });
  });

  describe("バリデーション", () => {
    it("documentIdが欠落している場合は400を返す", async () => {
      const { POST } = await import(
        "@/app/api/internal/analysis-callback/route"
      );
      const req = createRequest({ userId: USER_ID }, API_SECRET);

      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("userIdが欠落している場合は400を返す", async () => {
      const { POST } = await import(
        "@/app/api/internal/analysis-callback/route"
      );
      const req = createRequest({ documentId: DOC_ID }, API_SECRET);

      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("documentIdがUUID形式でない場合は400を返す", async () => {
      const { POST } = await import(
        "@/app/api/internal/analysis-callback/route"
      );
      const req = createRequest(
        { documentId: "not-a-uuid", userId: USER_ID },
        API_SECRET,
      );

      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("fragmentsのcontentが空文字の場合は400を返す", async () => {
      const { POST } = await import(
        "@/app/api/internal/analysis-callback/route"
      );
      const req = createRequest(
        {
          documentId: DOC_ID,
          userId: USER_ID,
          fragments: [{ type: "FACT", content: "", skills: [], keywords: [] }],
        },
        API_SECRET,
      );

      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("未知のプロパティがある場合は400を返す（strict mode）", async () => {
      const { POST } = await import(
        "@/app/api/internal/analysis-callback/route"
      );
      const req = createRequest(
        {
          documentId: DOC_ID,
          userId: USER_ID,
          maliciousField: "DROP TABLE",
        },
        API_SECRET,
      );

      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("fragmentsが500件を超える場合は400を返す", async () => {
      const { POST } = await import(
        "@/app/api/internal/analysis-callback/route"
      );
      const fragments = Array.from({ length: 501 }, (_, i) => ({
        type: "FACT",
        content: `Fragment ${i}`,
        skills: [],
        keywords: [],
      }));
      const req = createRequest(
        { documentId: DOC_ID, userId: USER_ID, fragments },
        API_SECRET,
      );

      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("バリデーションエラー時に警告ログを出力する", async () => {
      const { POST } = await import(
        "@/app/api/internal/analysis-callback/route"
      );
      const req = createRequest({ invalid: true }, API_SECRET);

      await POST(req);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Analysis callback validation failed",
        expect.objectContaining({ errors: expect.any(Array) }),
      );
    });
  });

  describe("エラーコールバック", () => {
    it("errorフィールドがある場合はドキュメントをFAILEDに更新する", async () => {
      const { POST } = await import(
        "@/app/api/internal/analysis-callback/route"
      );
      const req = createRequest(
        {
          documentId: DOC_ID,
          userId: USER_ID,
          error: "Lambda processing failed",
        },
        API_SECRET,
      );

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("FAILED");

      expect(mockPrisma.document.update).toHaveBeenCalledWith({
        where: { id: DOC_ID },
        data: {
          analysisStatus: "FAILED",
          analysisError: "Lambda processing failed",
        },
      });

      // フラグメントは作成しない
      expect(mockPrisma.fragment.createMany).not.toHaveBeenCalled();
    });
  });

  describe("成功コールバック", () => {
    it("フラグメントを作成してドキュメントをCOMPLETEDに更新する", async () => {
      const { POST } = await import(
        "@/app/api/internal/analysis-callback/route"
      );
      mockPrisma.fragment.createMany.mockResolvedValue({ count: 2 });

      const req = createRequest(
        {
          documentId: DOC_ID,
          userId: USER_ID,
          fragments: [
            {
              type: "FACT",
              content: "5年間のTypeScript経験",
              skills: ["TypeScript"],
              keywords: ["経験"],
            },
            {
              type: "SKILL_USAGE",
              content: "Reactでフロントエンド開発",
              skills: ["React"],
              keywords: ["フロントエンド"],
            },
          ],
        },
        API_SECRET,
      );

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("COMPLETED");
      expect(data.fragmentsCount).toBe(2);

      expect(mockPrisma.fragment.createMany).toHaveBeenCalledWith({
        data: [
          {
            userId: USER_ID,
            type: "FACT",
            content: "5年間のTypeScript経験",
            skills: ["TypeScript"],
            keywords: ["経験"],
            sourceType: "DOCUMENT",
            sourceId: DOC_ID,
          },
          {
            userId: USER_ID,
            type: "SKILL_USAGE",
            content: "Reactでフロントエンド開発",
            skills: ["React"],
            keywords: ["フロントエンド"],
            sourceType: "DOCUMENT",
            sourceId: DOC_ID,
          },
        ],
      });

      expect(mockPrisma.document.update).toHaveBeenCalledWith({
        where: { id: DOC_ID },
        data: expect.objectContaining({
          analysisStatus: "COMPLETED",
          summary: "2件の記憶のかけらを抽出しました",
        }),
      });
    });

    it("不明なフラグメントtypeはFACTにフォールバックする", async () => {
      const { POST } = await import(
        "@/app/api/internal/analysis-callback/route"
      );
      mockPrisma.fragment.createMany.mockResolvedValue({ count: 1 });

      const req = createRequest(
        {
          documentId: DOC_ID,
          userId: USER_ID,
          fragments: [
            {
              type: "UNKNOWN_TYPE",
              content: "何かの内容",
              skills: [],
              keywords: [],
            },
          ],
        },
        API_SECRET,
      );

      const res = await POST(req);
      expect(res.status).toBe(200);

      expect(mockPrisma.fragment.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ type: "FACT" })],
      });
    });

    it("フラグメントが空の場合はcreateMany呼び出しをスキップする", async () => {
      const { POST } = await import(
        "@/app/api/internal/analysis-callback/route"
      );
      const req = createRequest(
        { documentId: DOC_ID, userId: USER_ID, fragments: [] },
        API_SECRET,
      );

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.fragmentsCount).toBe(0);

      expect(mockPrisma.fragment.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.document.update).toHaveBeenCalledWith({
        where: { id: DOC_ID },
        data: expect.objectContaining({
          summary: "記憶のかけらが見つかりませんでした",
        }),
      });
    });

    it("summaryが指定されている場合はそれを使用する", async () => {
      const { POST } = await import(
        "@/app/api/internal/analysis-callback/route"
      );
      mockPrisma.fragment.createMany.mockResolvedValue({ count: 1 });

      const req = createRequest(
        {
          documentId: DOC_ID,
          userId: USER_ID,
          fragments: [
            { type: "FACT", content: "テスト", skills: [], keywords: [] },
          ],
          summary: "カスタムサマリー",
        },
        API_SECRET,
      );

      const res = await POST(req);
      expect(res.status).toBe(200);

      expect(mockPrisma.document.update).toHaveBeenCalledWith({
        where: { id: DOC_ID },
        data: expect.objectContaining({ summary: "カスタムサマリー" }),
      });
    });

    it("skillsとkeywordsがデフォルトで空配列になる", async () => {
      const { POST } = await import(
        "@/app/api/internal/analysis-callback/route"
      );
      mockPrisma.fragment.createMany.mockResolvedValue({ count: 1 });

      const req = createRequest(
        {
          documentId: DOC_ID,
          userId: USER_ID,
          fragments: [{ type: "FACT", content: "テスト内容" }],
        },
        API_SECRET,
      );

      const res = await POST(req);
      expect(res.status).toBe(200);

      expect(mockPrisma.fragment.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ skills: [], keywords: [] })],
      });
    });

    it("全有効なFragmentTypeが正しくマッピングされる", async () => {
      const { POST } = await import(
        "@/app/api/internal/analysis-callback/route"
      );
      const validTypes = [
        "ACHIEVEMENT",
        "ACTION",
        "CHALLENGE",
        "LEARNING",
        "VALUE",
        "EMOTION",
        "FACT",
        "SKILL_USAGE",
      ];
      const fragments = validTypes.map((type) => ({
        type,
        content: `${type}の内容`,
        skills: [],
        keywords: [],
      }));
      mockPrisma.fragment.createMany.mockResolvedValue({
        count: validTypes.length,
      });

      const req = createRequest(
        { documentId: DOC_ID, userId: USER_ID, fragments },
        API_SECRET,
      );

      const res = await POST(req);
      expect(res.status).toBe(200);

      const callArgs = mockPrisma.fragment.createMany.mock.calls[0][0];
      for (let i = 0; i < validTypes.length; i++) {
        expect(callArgs.data[i].type).toBe(validTypes[i]);
      }
    });
  });
});
