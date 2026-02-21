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

// アクセス制御モック
const mockIsCompanyAccessDenied = vi.fn();
vi.mock("@/lib/access-control", () => ({
  isCompanyAccessDenied: (...args: unknown[]) =>
    mockIsCompanyAccessDenied(...args),
}));

// Prisma モック
const mockPrisma = {
  agentProfile: { findUnique: vi.fn() },
  session: { findFirst: vi.fn() },
  interviewEvaluation: { findUnique: vi.fn(), upsert: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const AGENT_ID = "agent-001";
const RECRUITER_ID = "recruiter-001";
const COMPANY_ID = "company-001";
const SESSION_ID = "session-001";
const USER_ID = "user-001";

const recruiterSession = {
  user: {
    accountId: "acc-1",
    recruiterId: RECRUITER_ID,
    companyId: COMPANY_ID,
    accountType: "RECRUITER",
    companyRole: "ADMIN",
    recruiterStatus: "ACTIVE",
  },
};

const routeContext = { params: Promise.resolve({ id: AGENT_ID }) };

const mockAgent = {
  userId: USER_ID,
  status: "PUBLIC",
};

const mockChatSession = {
  id: SESSION_ID,
  agentId: AGENT_ID,
  recruiterId: RECRUITER_ID,
  sessionType: "RECRUITER_AGENT_CHAT",
};

const validEvaluationBody = {
  overallRating: 4,
  technicalRating: 3,
  communicationRating: 5,
  cultureRating: 4,
  comment: "優秀な候補者です。",
};

const mockEvaluation = {
  id: "eval-001",
  sessionId: SESSION_ID,
  recruiterId: RECRUITER_ID,
  ...validEvaluationBody,
};

function createGetRequest(): NextRequest {
  return new NextRequest(
    `http://localhost/api/interview/${AGENT_ID}/evaluation`,
    { method: "GET" },
  );
}

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/interview/${AGENT_ID}/evaluation`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

describe("GET /api/interview/[id]/evaluation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(recruiterSession);
    mockIsCompanyAccessDenied.mockResolvedValue(false);
    mockPrisma.agentProfile.findUnique.mockResolvedValue(mockAgent);
    mockPrisma.session.findFirst.mockResolvedValue(mockChatSession);
    mockPrisma.interviewEvaluation.findUnique.mockResolvedValue(mockEvaluation);
  });

  describe("認証", () => {
    it("未認証の場合は401を返す", async () => {
      mockGetServerSession.mockResolvedValue(null);
      const { GET } = await import("@/app/api/interview/[id]/evaluation/route");

      const res = await GET(createGetRequest(), routeContext);
      expect(res.status).toBe(401);
    });
  });

  describe("エージェント検証", () => {
    it("存在しないエージェントは404を返す", async () => {
      mockPrisma.agentProfile.findUnique.mockResolvedValue(null);
      const { GET } = await import("@/app/api/interview/[id]/evaluation/route");

      const res = await GET(createGetRequest(), routeContext);
      expect(res.status).toBe(404);
    });

    it("非公開エージェントは403を返す", async () => {
      mockPrisma.agentProfile.findUnique.mockResolvedValue({
        ...mockAgent,
        status: "PRIVATE",
      });
      const { GET } = await import("@/app/api/interview/[id]/evaluation/route");

      const res = await GET(createGetRequest(), routeContext);
      expect(res.status).toBe(403);
    });

    it("アクセス拒否された企業は403を返す", async () => {
      mockIsCompanyAccessDenied.mockResolvedValue(true);
      const { GET } = await import("@/app/api/interview/[id]/evaluation/route");

      const res = await GET(createGetRequest(), routeContext);
      expect(res.status).toBe(403);
      expect(mockIsCompanyAccessDenied).toHaveBeenCalledWith(
        COMPANY_ID,
        USER_ID,
      );
    });
  });

  describe("正常系", () => {
    it("面接セッションがない場合はnullを返す", async () => {
      mockPrisma.session.findFirst.mockResolvedValue(null);
      const { GET } = await import("@/app/api/interview/[id]/evaluation/route");

      const res = await GET(createGetRequest(), routeContext);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.evaluation).toBeNull();
    });

    it("評価が存在する場合はそれを返す", async () => {
      const { GET } = await import("@/app/api/interview/[id]/evaluation/route");

      const res = await GET(createGetRequest(), routeContext);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.evaluation).toEqual(mockEvaluation);
    });

    it("正しいセッション条件でクエリする", async () => {
      const { GET } = await import("@/app/api/interview/[id]/evaluation/route");

      await GET(createGetRequest(), routeContext);

      expect(mockPrisma.session.findFirst).toHaveBeenCalledWith({
        where: {
          agentId: AGENT_ID,
          recruiterId: RECRUITER_ID,
          sessionType: "RECRUITER_AGENT_CHAT",
        },
      });
    });
  });
});

describe("POST /api/interview/[id]/evaluation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(recruiterSession);
    mockIsCompanyAccessDenied.mockResolvedValue(false);
    mockPrisma.agentProfile.findUnique.mockResolvedValue(mockAgent);
    mockPrisma.session.findFirst.mockResolvedValue(mockChatSession);
    mockPrisma.interviewEvaluation.upsert.mockResolvedValue(mockEvaluation);
  });

  describe("バリデーション", () => {
    it("評価項目がない場合は400を返す", async () => {
      const { POST } = await import(
        "@/app/api/interview/[id]/evaluation/route"
      );

      const res = await POST(createPostRequest({}), routeContext);
      expect(res.status).toBe(400);
    });

    it("評価が範囲外（0以下）の場合は400を返す", async () => {
      const { POST } = await import(
        "@/app/api/interview/[id]/evaluation/route"
      );

      const res = await POST(
        createPostRequest({ ...validEvaluationBody, overallRating: 0 }),
        routeContext,
      );
      expect(res.status).toBe(400);
    });

    it("評価が範囲外（6以上）の場合は400を返す", async () => {
      const { POST } = await import(
        "@/app/api/interview/[id]/evaluation/route"
      );

      const res = await POST(
        createPostRequest({ ...validEvaluationBody, technicalRating: 6 }),
        routeContext,
      );
      expect(res.status).toBe(400);
    });

    it("評価が小数の場合は400を返す", async () => {
      const { POST } = await import(
        "@/app/api/interview/[id]/evaluation/route"
      );

      const res = await POST(
        createPostRequest({
          ...validEvaluationBody,
          communicationRating: 3.5,
        }),
        routeContext,
      );
      expect(res.status).toBe(400);
    });

    it("コメントが5000文字を超える場合は400を返す", async () => {
      const { POST } = await import(
        "@/app/api/interview/[id]/evaluation/route"
      );

      const res = await POST(
        createPostRequest({
          ...validEvaluationBody,
          comment: "a".repeat(5001),
        }),
        routeContext,
      );
      expect(res.status).toBe(400);
    });

    it("コメントが5000文字以内の場合は受け付ける", async () => {
      const { POST } = await import(
        "@/app/api/interview/[id]/evaluation/route"
      );

      const res = await POST(
        createPostRequest({
          ...validEvaluationBody,
          comment: "a".repeat(5000),
        }),
        routeContext,
      );
      expect(res.status).toBe(200);
    });
  });

  describe("エージェント検証", () => {
    it("存在しないエージェントは404を返す", async () => {
      mockPrisma.agentProfile.findUnique.mockResolvedValue(null);
      const { POST } = await import(
        "@/app/api/interview/[id]/evaluation/route"
      );

      const res = await POST(
        createPostRequest(validEvaluationBody),
        routeContext,
      );
      expect(res.status).toBe(404);
    });

    it("面接セッションがない場合は404を返す", async () => {
      mockPrisma.session.findFirst.mockResolvedValue(null);
      const { POST } = await import(
        "@/app/api/interview/[id]/evaluation/route"
      );

      const res = await POST(
        createPostRequest(validEvaluationBody),
        routeContext,
      );
      expect(res.status).toBe(404);
    });
  });

  describe("正常系", () => {
    it("評価をupsertで作成・更新し200を返す", async () => {
      const { POST } = await import(
        "@/app/api/interview/[id]/evaluation/route"
      );

      const res = await POST(
        createPostRequest(validEvaluationBody),
        routeContext,
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.evaluation).toEqual(mockEvaluation);
    });

    it("upsertに正しいパラメータを渡す", async () => {
      const { POST } = await import(
        "@/app/api/interview/[id]/evaluation/route"
      );

      await POST(createPostRequest(validEvaluationBody), routeContext);

      expect(mockPrisma.interviewEvaluation.upsert).toHaveBeenCalledWith({
        where: { sessionId: SESSION_ID },
        update: {
          overallRating: 4,
          technicalRating: 3,
          communicationRating: 5,
          cultureRating: 4,
          comment: "優秀な候補者です。",
        },
        create: {
          sessionId: SESSION_ID,
          recruiterId: RECRUITER_ID,
          overallRating: 4,
          technicalRating: 3,
          communicationRating: 5,
          cultureRating: 4,
          comment: "優秀な候補者です。",
        },
      });
    });

    it("コメントなしの場合はnullが保存される", async () => {
      const { POST } = await import(
        "@/app/api/interview/[id]/evaluation/route"
      );

      const { comment: _, ...bodyWithoutComment } = validEvaluationBody;
      await POST(createPostRequest(bodyWithoutComment), routeContext);

      expect(mockPrisma.interviewEvaluation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ comment: null }),
          create: expect.objectContaining({ comment: null }),
        }),
      );
    });

    it("空コメントの場合はnullが保存される", async () => {
      const { POST } = await import(
        "@/app/api/interview/[id]/evaluation/route"
      );

      await POST(
        createPostRequest({ ...validEvaluationBody, comment: "" }),
        routeContext,
      );

      expect(mockPrisma.interviewEvaluation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ comment: null }),
          create: expect.objectContaining({ comment: null }),
        }),
      );
    });
  });
});
