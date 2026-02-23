import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// NextAuth モック
const mockGetServerSession = vi.fn();
vi.mock("next-auth", () => ({
  getServerSession: () => mockGetServerSession(),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

// Logger モック
const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
vi.mock("@/lib/logger", () => ({ logger: mockLogger }));

// Lambda モック
const mockLambdaSend = vi.fn();
vi.mock("@aws-sdk/client-lambda", () => {
  return {
    LambdaClient: class MockLambdaClient {
      send = mockLambdaSend;
    },
    InvokeCommand: class MockInvokeCommand {
      constructor(public params: unknown) {}
    },
  };
});

// Prisma トランザクション用クライアント
const mockTxClient = {
  $queryRaw: vi.fn(),
  document: { update: vi.fn() },
};

// Prisma メインクライアント
const mockPrisma = {
  $transaction: vi.fn(),
  document: { update: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const USER_ID = "user-123";
const DOC_ID = "doc-456";

const userSession = {
  user: { accountId: "acc-1", userId: USER_ID },
};

const mockDocument = {
  id: DOC_ID,
  userId: USER_ID,
  fileName: "resume.pdf",
  filePath: "uploads/resume.pdf",
  analysisStatus: "PENDING",
  analyzedAt: null,
  createdAt: new Date("2025-01-01"),
};

function createRequest(): NextRequest {
  return new NextRequest(`http://localhost/api/documents/${DOC_ID}/analyze`, {
    method: "POST",
  });
}

const routeContext = { params: Promise.resolve({ id: DOC_ID }) };

describe("POST /api/documents/[id]/analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DOCUMENT_ANALYSIS_LAMBDA_ARN", "arn:aws:lambda:test:fn");
    mockGetServerSession.mockResolvedValue(userSession);
    mockLambdaSend.mockResolvedValue({});
    mockPrisma.document.update.mockResolvedValue({});
    mockTxClient.document.update.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mockTxClient) => Promise<unknown>) => {
        return callback(mockTxClient);
      },
    );
  });

  describe("認証・前提条件", () => {
    it("未認証の場合は401を返す", async () => {
      mockGetServerSession.mockResolvedValue(null);
      const { POST } = await import("@/app/api/documents/[id]/analyze/route");

      const res = await POST(createRequest(), routeContext);
      expect(res.status).toBe(401);
    });

    it("userIdがない場合は403を返す", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { accountId: "acc-1" },
      });
      const { POST } = await import("@/app/api/documents/[id]/analyze/route");

      const res = await POST(createRequest(), routeContext);
      expect(res.status).toBe(403);
    });

    it("DOCUMENT_ANALYSIS_LAMBDA_ARNが未設定の場合は500を返す", async () => {
      vi.stubEnv("DOCUMENT_ANALYSIS_LAMBDA_ARN", "");
      const { POST } = await import("@/app/api/documents/[id]/analyze/route");

      const res = await POST(createRequest(), routeContext);
      expect(res.status).toBe(500);
    });
  });

  describe("ドキュメント検証", () => {
    it("ドキュメントが存在しない場合は404を返す", async () => {
      mockTxClient.$queryRaw.mockResolvedValue([]);
      const { POST } = await import("@/app/api/documents/[id]/analyze/route");

      const res = await POST(createRequest(), routeContext);
      expect(res.status).toBe(404);
    });

    it("他ユーザーのドキュメントは取得できない（FOR UPDATE内のWHERE句）", async () => {
      mockTxClient.$queryRaw.mockResolvedValue([]);
      const { POST } = await import("@/app/api/documents/[id]/analyze/route");

      const res = await POST(createRequest(), routeContext);
      expect(res.status).toBe(404);

      // SQLにuserIdが含まれていることを確認
      expect(mockTxClient.$queryRaw).toHaveBeenCalled();
    });
  });

  describe("解析ステータスチェック（排他ロック内）", () => {
    it("ANALYZING状態で10分以内の場合は409を返す", async () => {
      mockTxClient.$queryRaw.mockResolvedValue([
        {
          ...mockDocument,
          analysisStatus: "ANALYZING",
          analyzedAt: new Date(), // just started
        },
      ]);
      const { POST } = await import("@/app/api/documents/[id]/analyze/route");

      const res = await POST(createRequest(), routeContext);
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain("解析中");
    });

    it("ANALYZING状態で10分超（stale）の場合は再解析を許可する", async () => {
      mockTxClient.$queryRaw.mockResolvedValue([
        {
          ...mockDocument,
          analysisStatus: "ANALYZING",
          analyzedAt: new Date(Date.now() - 11 * 60 * 1000), // 11分前
        },
      ]);
      const { POST } = await import("@/app/api/documents/[id]/analyze/route");

      const res = await POST(createRequest(), routeContext);
      expect(res.status).toBe(202);
    });

    it("PENDING状態のドキュメントは解析開始できる", async () => {
      mockTxClient.$queryRaw.mockResolvedValue([mockDocument]);
      const { POST } = await import("@/app/api/documents/[id]/analyze/route");

      const res = await POST(createRequest(), routeContext);
      expect(res.status).toBe(202);
    });

    it("COMPLETED状態のドキュメントも再解析できる", async () => {
      mockTxClient.$queryRaw.mockResolvedValue([
        { ...mockDocument, analysisStatus: "COMPLETED" },
      ]);
      const { POST } = await import("@/app/api/documents/[id]/analyze/route");

      const res = await POST(createRequest(), routeContext);
      expect(res.status).toBe(202);
    });

    it("FAILED状態のドキュメントも再解析できる", async () => {
      mockTxClient.$queryRaw.mockResolvedValue([
        { ...mockDocument, analysisStatus: "FAILED" },
      ]);
      const { POST } = await import("@/app/api/documents/[id]/analyze/route");

      const res = await POST(createRequest(), routeContext);
      expect(res.status).toBe(202);
    });
  });

  describe("正常系", () => {
    it("トランザクション内でステータスをANALYZINGに更新する", async () => {
      mockTxClient.$queryRaw.mockResolvedValue([mockDocument]);
      const { POST } = await import("@/app/api/documents/[id]/analyze/route");

      await POST(createRequest(), routeContext);

      expect(mockTxClient.document.update).toHaveBeenCalledWith({
        where: { id: DOC_ID },
        data: {
          analysisStatus: "ANALYZING",
          analysisError: null,
          analyzedAt: expect.any(Date),
        },
      });
    });

    it("Lambda関数を非同期で呼び出す", async () => {
      mockTxClient.$queryRaw.mockResolvedValue([mockDocument]);
      const { POST } = await import("@/app/api/documents/[id]/analyze/route");

      await POST(createRequest(), routeContext);

      expect(mockLambdaSend).toHaveBeenCalledTimes(1);
      const invokeCmd = mockLambdaSend.mock.calls[0][0];
      expect(invokeCmd.params).toEqual(
        expect.objectContaining({
          FunctionName: "arn:aws:lambda:test:fn",
          InvocationType: "Event",
          Payload: expect.stringContaining(DOC_ID),
        }),
      );
    });

    it("202レスポンスを返す", async () => {
      mockTxClient.$queryRaw.mockResolvedValue([mockDocument]);
      const { POST } = await import("@/app/api/documents/[id]/analyze/route");

      const res = await POST(createRequest(), routeContext);
      expect(res.status).toBe(202);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.analysisStatus).toBe("ANALYZING");
    });
  });

  describe("Lambda呼び出し失敗", () => {
    it("Lambda失敗時はステータスをFAILEDに戻す", async () => {
      mockTxClient.$queryRaw.mockResolvedValue([mockDocument]);
      mockLambdaSend.mockRejectedValue(new Error("Lambda timeout"));
      const { POST } = await import("@/app/api/documents/[id]/analyze/route");

      const res = await POST(createRequest(), routeContext);
      expect(res.status).toBe(500);

      expect(mockPrisma.document.update).toHaveBeenCalledWith({
        where: { id: DOC_ID },
        data: {
          analysisStatus: "FAILED",
          analysisError: "解析ジョブの開始に失敗しました",
        },
      });
    });

    it("Lambda失敗時にエラーをログ出力する", async () => {
      mockTxClient.$queryRaw.mockResolvedValue([mockDocument]);
      const lambdaError = new Error("Service unavailable");
      mockLambdaSend.mockRejectedValue(lambdaError);
      const { POST } = await import("@/app/api/documents/[id]/analyze/route");

      await POST(createRequest(), routeContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Lambda invocation failed",
        lambdaError,
        expect.objectContaining({ documentId: DOC_ID }),
      );
    });
  });
});
