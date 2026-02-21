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

// トランザクション用クライアント
const mockTxClient = {
  candidatePipeline: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
};

// Prisma メインクライアント
const mockPrisma = {
  candidatePipeline: { findMany: vi.fn() },
  agentProfile: { findFirst: vi.fn() },
  jobPosting: { findFirst: vi.fn() },
  $transaction: vi.fn(),
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// access-control
const mockIsCompanyAccessDenied = vi.fn();
vi.mock("@/lib/access-control", () => ({
  isCompanyAccessDenied: (...args: unknown[]) =>
    mockIsCompanyAccessDenied(...args),
}));

const RECRUITER_ID = "recruiter-001";
const COMPANY_ID = "company-001";
const AGENT_ID = "agent-001";
const AGENT_USER_ID = "user-001";
const JOB_ID = "job-001";

const recruiterSession = {
  user: {
    accountId: "acc-1",
    recruiterId: RECRUITER_ID,
    companyId: COMPANY_ID,
    accountType: "RECRUITER",
    recruiterStatus: "ACTIVE",
  },
};

const mockAgent = {
  id: AGENT_ID,
  userId: AGENT_USER_ID,
  status: "PUBLIC",
};

const mockCreatedPipeline = {
  id: "pipeline-001",
  recruiterId: RECRUITER_ID,
  agentId: AGENT_ID,
  jobId: null,
  stage: "INTERESTED",
  agent: { user: { name: "テスト太郎" } },
  job: null,
};

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/recruiter/pipeline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/recruiter/pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(recruiterSession);
    mockPrisma.agentProfile.findFirst.mockResolvedValue(mockAgent);
    mockIsCompanyAccessDenied.mockResolvedValue(false);
    mockTxClient.candidatePipeline.findFirst.mockResolvedValue(null);
    mockTxClient.candidatePipeline.create.mockResolvedValue(
      mockCreatedPipeline,
    );
    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mockTxClient) => Promise<unknown>) => {
        return callback(mockTxClient);
      },
    );
  });

  describe("認証", () => {
    it("未認証の場合は401を返す", async () => {
      mockGetServerSession.mockResolvedValue(null);
      const { POST } = await import("@/app/api/recruiter/pipeline/route");

      const res = await POST(createPostRequest({ agentId: AGENT_ID }));
      expect(res.status).toBe(401);
    });
  });

  describe("バリデーション", () => {
    it("agentIdが空の場合は400を返す", async () => {
      const { POST } = await import("@/app/api/recruiter/pipeline/route");

      const res = await POST(createPostRequest({ agentId: "" }));
      expect(res.status).toBe(400);
    });

    it("noteが5000文字を超える場合は400を返す", async () => {
      const { POST } = await import("@/app/api/recruiter/pipeline/route");

      const res = await POST(
        createPostRequest({ agentId: AGENT_ID, note: "a".repeat(5001) }),
      );
      expect(res.status).toBe(400);
    });

    it("無効なステージは400を返す", async () => {
      const { POST } = await import("@/app/api/recruiter/pipeline/route");

      const res = await POST(
        createPostRequest({ agentId: AGENT_ID, stage: "INVALID" }),
      );
      expect(res.status).toBe(400);
    });
  });

  describe("状態チェック", () => {
    it("存在しないエージェントは404を返す", async () => {
      mockPrisma.agentProfile.findFirst.mockResolvedValue(null);
      const { POST } = await import("@/app/api/recruiter/pipeline/route");

      const res = await POST(createPostRequest({ agentId: AGENT_ID }));
      expect(res.status).toBe(404);
    });

    it("アクセス拒否の場合は403を返す", async () => {
      mockIsCompanyAccessDenied.mockResolvedValue(true);
      const { POST } = await import("@/app/api/recruiter/pipeline/route");

      const res = await POST(createPostRequest({ agentId: AGENT_ID }));
      expect(res.status).toBe(403);
    });

    it("存在しない求人は404を返す", async () => {
      mockPrisma.jobPosting.findFirst.mockResolvedValue(null);
      const { POST } = await import("@/app/api/recruiter/pipeline/route");

      const res = await POST(
        createPostRequest({ agentId: AGENT_ID, jobId: JOB_ID }),
      );
      expect(res.status).toBe(404);
    });
  });

  describe("重複チェック", () => {
    it("既存パイプラインがある場合は409を返す", async () => {
      mockTxClient.candidatePipeline.findFirst.mockResolvedValue({
        id: "existing-pipeline",
      });
      const { POST } = await import("@/app/api/recruiter/pipeline/route");

      const res = await POST(createPostRequest({ agentId: AGENT_ID }));
      expect(res.status).toBe(409);
    });

    it("P2002ユニーク制約違反は409を返す", async () => {
      const p2002Error = Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
      });
      mockPrisma.$transaction.mockRejectedValue(p2002Error);
      const { POST } = await import("@/app/api/recruiter/pipeline/route");

      const res = await POST(createPostRequest({ agentId: AGENT_ID }));
      expect(res.status).toBe(409);
    });
  });

  describe("正常系", () => {
    it("パイプラインが正常に作成される", async () => {
      const { POST } = await import("@/app/api/recruiter/pipeline/route");

      const res = await POST(createPostRequest({ agentId: AGENT_ID }));
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.pipeline).toBeDefined();
    });

    it("デフォルトステージはINTERESTEDになる", async () => {
      const { POST } = await import("@/app/api/recruiter/pipeline/route");

      await POST(createPostRequest({ agentId: AGENT_ID }));

      expect(mockTxClient.candidatePipeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stage: "INTERESTED",
          }),
        }),
      );
    });

    it("カスタムステージが指定できる", async () => {
      const { POST } = await import("@/app/api/recruiter/pipeline/route");

      await POST(createPostRequest({ agentId: AGENT_ID, stage: "SCREENING" }));

      expect(mockTxClient.candidatePipeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stage: "SCREENING",
          }),
        }),
      );
    });

    it("求人IDとnoteが指定できる", async () => {
      mockPrisma.jobPosting.findFirst.mockResolvedValue({ id: JOB_ID });
      const { POST } = await import("@/app/api/recruiter/pipeline/route");

      await POST(
        createPostRequest({
          agentId: AGENT_ID,
          jobId: JOB_ID,
          note: "良い候補者",
        }),
      );

      expect(mockTxClient.candidatePipeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jobId: JOB_ID,
            note: "良い候補者",
          }),
        }),
      );
    });
  });

  describe("TOCTOU防止", () => {
    it("トランザクション内で重複チェックと作成を行う", async () => {
      const { POST } = await import("@/app/api/recruiter/pipeline/route");

      await POST(createPostRequest({ agentId: AGENT_ID }));

      // メインクライアントではなくtxクライアントでfindFirstが呼ばれる
      expect(mockTxClient.candidatePipeline.findFirst).toHaveBeenCalledWith({
        where: {
          recruiterId: RECRUITER_ID,
          agentId: AGENT_ID,
          jobId: null,
        },
      });
      // txクライアントでcreateが呼ばれる
      expect(mockTxClient.candidatePipeline.create).toHaveBeenCalled();
    });

    it("トランザクション内で重複検出するとcreateは呼ばれない", async () => {
      mockTxClient.candidatePipeline.findFirst.mockResolvedValue({
        id: "existing",
      });
      const { POST } = await import("@/app/api/recruiter/pipeline/route");

      await POST(createPostRequest({ agentId: AGENT_ID }));

      expect(mockTxClient.candidatePipeline.create).not.toHaveBeenCalled();
    });
  });
});
