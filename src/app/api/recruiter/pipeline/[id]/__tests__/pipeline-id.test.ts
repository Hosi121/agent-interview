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

// Prisma トランザクション用クライアント
const mockTxClient = {
  candidatePipeline: {
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  companyAccess: { findUnique: vi.fn() },
  pipelineHistory: { create: vi.fn() },
};

// Prisma メインクライアント
const mockPrisma = {
  candidatePipeline: { findFirst: vi.fn() },
  session: { findMany: vi.fn() },
  companyAccess: { findUnique: vi.fn() },
  $transaction: vi.fn(),
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// access-control（GET用）
const mockIsCompanyAccessDenied = vi.fn();
vi.mock("@/lib/access-control", () => ({
  isCompanyAccessDenied: (...args: unknown[]) =>
    mockIsCompanyAccessDenied(...args),
}));

const PIPELINE_ID = "pipeline-001";
const RECRUITER_ID = "recruiter-001";
const COMPANY_ID = "company-001";
const AGENT_USER_ID = "user-agent-001";

const recruiterSession = {
  user: {
    accountId: "acc-1",
    recruiterId: RECRUITER_ID,
    companyId: COMPANY_ID,
    accountType: "RECRUITER",
    recruiterStatus: "ACTIVE",
  },
};

const routeContext = {
  params: Promise.resolve({ id: PIPELINE_ID }),
};

const mockPipeline = {
  id: PIPELINE_ID,
  recruiterId: RECRUITER_ID,
  agentId: "agent-001",
  stage: "INTERESTED",
  note: null,
  agent: {
    userId: AGENT_USER_ID,
    user: { name: "テスト太郎" },
  },
  job: { id: "job-001", title: "テスト求人" },
  history: [],
};

function createPatchRequest(body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/recruiter/pipeline/${PIPELINE_ID}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function createDeleteRequest(): NextRequest {
  return new NextRequest(
    `http://localhost/api/recruiter/pipeline/${PIPELINE_ID}`,
    { method: "DELETE" },
  );
}

describe("PATCH /api/recruiter/pipeline/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(recruiterSession);
    mockTxClient.candidatePipeline.findFirst.mockResolvedValue(mockPipeline);
    mockTxClient.companyAccess.findUnique.mockResolvedValue(null);
    mockTxClient.pipelineHistory.create.mockResolvedValue({});
    mockTxClient.candidatePipeline.update.mockResolvedValue({
      ...mockPipeline,
      stage: "CONTACTED",
      history: [
        {
          fromStage: "INTERESTED",
          toStage: "CONTACTED",
          createdAt: new Date(),
        },
      ],
    });
    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mockTxClient) => Promise<unknown>) => {
        return callback(mockTxClient);
      },
    );
  });

  describe("認証", () => {
    it("未認証の場合は401を返す", async () => {
      mockGetServerSession.mockResolvedValue(null);
      const { PATCH } = await import("@/app/api/recruiter/pipeline/[id]/route");

      const res = await PATCH(
        createPatchRequest({ stage: "CONTACTED" }),
        routeContext,
      );
      expect(res.status).toBe(401);
    });
  });

  describe("バリデーション", () => {
    it("無効なステージは400を返す", async () => {
      const { PATCH } = await import("@/app/api/recruiter/pipeline/[id]/route");

      const res = await PATCH(
        createPatchRequest({ stage: "INVALID" }),
        routeContext,
      );
      expect(res.status).toBe(400);
    });

    it("noteが5000文字を超える場合は400を返す", async () => {
      const { PATCH } = await import("@/app/api/recruiter/pipeline/[id]/route");

      const res = await PATCH(
        createPatchRequest({ note: "a".repeat(5001) }),
        routeContext,
      );
      expect(res.status).toBe(400);
    });
  });

  describe("状態チェック", () => {
    it("存在しないパイプラインは404を返す", async () => {
      mockTxClient.candidatePipeline.findFirst.mockResolvedValue(null);
      const { PATCH } = await import("@/app/api/recruiter/pipeline/[id]/route");

      const res = await PATCH(
        createPatchRequest({ stage: "CONTACTED" }),
        routeContext,
      );
      expect(res.status).toBe(404);
    });

    it("アクセス拒否されている場合は403を返す", async () => {
      mockTxClient.companyAccess.findUnique.mockResolvedValue({
        status: "DENY",
      });
      const { PATCH } = await import("@/app/api/recruiter/pipeline/[id]/route");

      const res = await PATCH(
        createPatchRequest({ stage: "CONTACTED" }),
        routeContext,
      );
      expect(res.status).toBe(403);
    });
  });

  describe("正常系", () => {
    it("ステージ変更が成功する", async () => {
      const { PATCH } = await import("@/app/api/recruiter/pipeline/[id]/route");

      const res = await PATCH(
        createPatchRequest({ stage: "CONTACTED" }),
        routeContext,
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.pipeline).toBeDefined();
    });

    it("noteのみの更新が成功する", async () => {
      mockTxClient.candidatePipeline.update.mockResolvedValue({
        ...mockPipeline,
        note: "メモ更新",
      });
      const { PATCH } = await import("@/app/api/recruiter/pipeline/[id]/route");

      const res = await PATCH(
        createPatchRequest({ note: "メモ更新" }),
        routeContext,
      );
      expect(res.status).toBe(200);
      // noteだけの場合はhistory作成されない
      expect(mockTxClient.pipelineHistory.create).not.toHaveBeenCalled();
    });

    it("ステージ変更時に履歴が記録される", async () => {
      const { PATCH } = await import("@/app/api/recruiter/pipeline/[id]/route");

      await PATCH(createPatchRequest({ stage: "CONTACTED" }), routeContext);

      expect(mockTxClient.pipelineHistory.create).toHaveBeenCalledWith({
        data: {
          pipelineId: PIPELINE_ID,
          fromStage: "INTERESTED",
          toStage: "CONTACTED",
          note: undefined,
        },
      });
    });

    it("同じステージへの変更では履歴は作成されない", async () => {
      const { PATCH } = await import("@/app/api/recruiter/pipeline/[id]/route");

      await PATCH(createPatchRequest({ stage: "INTERESTED" }), routeContext);

      expect(mockTxClient.pipelineHistory.create).not.toHaveBeenCalled();
    });
  });

  describe("TOCTOU防止", () => {
    it("トランザクション内でパイプラインを取得する", async () => {
      const { PATCH } = await import("@/app/api/recruiter/pipeline/[id]/route");

      await PATCH(createPatchRequest({ stage: "CONTACTED" }), routeContext);

      // メインクライアントのfindFirstは呼ばれない（txクライアントが呼ばれる）
      expect(mockPrisma.candidatePipeline.findFirst).not.toHaveBeenCalled();
      expect(mockTxClient.candidatePipeline.findFirst).toHaveBeenCalledWith({
        where: {
          id: PIPELINE_ID,
          recruiterId: RECRUITER_ID,
        },
        include: {
          agent: {
            select: { userId: true },
          },
        },
      });
    });

    it("トランザクション内でアクセスチェックする", async () => {
      const { PATCH } = await import("@/app/api/recruiter/pipeline/[id]/route");

      await PATCH(createPatchRequest({ stage: "CONTACTED" }), routeContext);

      expect(mockTxClient.companyAccess.findUnique).toHaveBeenCalledWith({
        where: {
          userId_companyId: {
            userId: AGENT_USER_ID,
            companyId: COMPANY_ID,
          },
        },
        select: { status: true },
      });
    });

    it("ALLOWステータスではアクセス許可される", async () => {
      mockTxClient.companyAccess.findUnique.mockResolvedValue({
        status: "ALLOW",
      });
      const { PATCH } = await import("@/app/api/recruiter/pipeline/[id]/route");

      const res = await PATCH(
        createPatchRequest({ stage: "CONTACTED" }),
        routeContext,
      );
      expect(res.status).toBe(200);
    });
  });
});

describe("DELETE /api/recruiter/pipeline/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(recruiterSession);
    mockTxClient.candidatePipeline.findFirst.mockResolvedValue(mockPipeline);
    mockTxClient.companyAccess.findUnique.mockResolvedValue(null);
    mockTxClient.candidatePipeline.delete.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mockTxClient) => Promise<unknown>) => {
        return callback(mockTxClient);
      },
    );
  });

  describe("認証", () => {
    it("未認証の場合は401を返す", async () => {
      mockGetServerSession.mockResolvedValue(null);
      const { DELETE } = await import(
        "@/app/api/recruiter/pipeline/[id]/route"
      );

      const res = await DELETE(createDeleteRequest(), routeContext);
      expect(res.status).toBe(401);
    });
  });

  describe("状態チェック", () => {
    it("存在しないパイプラインは404を返す", async () => {
      mockTxClient.candidatePipeline.findFirst.mockResolvedValue(null);
      const { DELETE } = await import(
        "@/app/api/recruiter/pipeline/[id]/route"
      );

      const res = await DELETE(createDeleteRequest(), routeContext);
      expect(res.status).toBe(404);
    });

    it("アクセス拒否されている場合は403を返す", async () => {
      mockTxClient.companyAccess.findUnique.mockResolvedValue({
        status: "DENY",
      });
      const { DELETE } = await import(
        "@/app/api/recruiter/pipeline/[id]/route"
      );

      const res = await DELETE(createDeleteRequest(), routeContext);
      expect(res.status).toBe(403);
    });
  });

  describe("正常系", () => {
    it("削除が成功する", async () => {
      const { DELETE } = await import(
        "@/app/api/recruiter/pipeline/[id]/route"
      );

      const res = await DELETE(createDeleteRequest(), routeContext);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it("正しいIDで削除される", async () => {
      const { DELETE } = await import(
        "@/app/api/recruiter/pipeline/[id]/route"
      );

      await DELETE(createDeleteRequest(), routeContext);

      expect(mockTxClient.candidatePipeline.delete).toHaveBeenCalledWith({
        where: { id: PIPELINE_ID },
      });
    });
  });

  describe("TOCTOU防止", () => {
    it("トランザクション内でパイプラインを取得・検証・削除する", async () => {
      const { DELETE } = await import(
        "@/app/api/recruiter/pipeline/[id]/route"
      );

      await DELETE(createDeleteRequest(), routeContext);

      // メインクライアントのfindFirstは呼ばれない
      expect(mockPrisma.candidatePipeline.findFirst).not.toHaveBeenCalled();
      // txクライアントでfindFirstが呼ばれる
      expect(mockTxClient.candidatePipeline.findFirst).toHaveBeenCalled();
      // txクライアントでアクセスチェック
      expect(mockTxClient.companyAccess.findUnique).toHaveBeenCalledWith({
        where: {
          userId_companyId: {
            userId: AGENT_USER_ID,
            companyId: COMPANY_ID,
          },
        },
        select: { status: true },
      });
      // txクライアントで削除
      expect(mockTxClient.candidatePipeline.delete).toHaveBeenCalled();
    });
  });
});
