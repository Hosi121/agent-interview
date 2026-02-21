import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────

const mockGetServerSession = vi.fn();
vi.mock("next-auth", () => ({
  getServerSession: () => mockGetServerSession(),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
vi.mock("@/lib/logger", () => ({ logger: mockLogger }));

const mockPrisma = {
  jobPosting: {
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ── Constants ──────────────────────────────────────────────────────

const RECRUITER_ID = "recruiter-001";
const OTHER_RECRUITER_ID = "recruiter-999";
const COMPANY_ID = "company-001";
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

const otherRecruiterSession = {
  user: {
    accountId: "acc-2",
    recruiterId: OTHER_RECRUITER_ID,
    companyId: COMPANY_ID,
    accountType: "RECRUITER",
    recruiterStatus: "ACTIVE",
  },
};

const mockJob = {
  id: JOB_ID,
  recruiterId: RECRUITER_ID,
  title: "フロントエンドエンジニア",
  description: "Reactを用いたフロントエンド開発",
  requirements: "React 3年以上",
  preferredSkills: "TypeScript",
  skills: ["React", "TypeScript"],
  keywords: ["フロントエンド"],
  employmentType: "FULL_TIME",
  experienceLevel: "MID",
  location: "東京",
  salaryMin: 5000000,
  salaryMax: 8000000,
  isRemote: true,
  status: "ACTIVE",
  matches: [],
  pipelines: [],
  _count: { matches: 5, pipelines: 2, watches: 1 },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const routeContext = {
  params: Promise.resolve({ id: JOB_ID }),
};

// ── Helpers ────────────────────────────────────────────────────────

function createRequest(method: string, body?: unknown): NextRequest {
  if (body) {
    return new NextRequest(`http://localhost/api/recruiter/jobs/${JOB_ID}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  return new NextRequest(`http://localhost/api/recruiter/jobs/${JOB_ID}`, {
    method,
  });
}

// ── GET Tests ──────────────────────────────────────────────────────

describe("GET /api/recruiter/jobs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(recruiterSession);
  });

  it("自分の求人詳細を取得できる", async () => {
    mockPrisma.jobPosting.findFirst.mockResolvedValue(mockJob);

    const { GET } = await import("@/app/api/recruiter/jobs/[id]/route");
    const response = await GET(createRequest("GET"), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.job.id).toBe(JOB_ID);
    expect(data.job.title).toBe("フロントエンドエンジニア");
  });

  it("recruiterId条件でフィルタされる（他リクルーターの求人は見えない）", async () => {
    mockPrisma.jobPosting.findFirst.mockResolvedValue(mockJob);

    const { GET } = await import("@/app/api/recruiter/jobs/[id]/route");
    await GET(createRequest("GET"), routeContext);

    expect(mockPrisma.jobPosting.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: JOB_ID,
          recruiterId: RECRUITER_ID,
        },
      }),
    );
  });

  it("存在しない求人の場合404を返す", async () => {
    mockPrisma.jobPosting.findFirst.mockResolvedValue(null);

    const { GET } = await import("@/app/api/recruiter/jobs/[id]/route");
    const response = await GET(createRequest("GET"), routeContext);

    expect(response.status).toBe(404);
  });

  it("未認証の場合401を返す", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { GET } = await import("@/app/api/recruiter/jobs/[id]/route");
    const response = await GET(createRequest("GET"), routeContext);

    expect(response.status).toBe(401);
  });

  it("recruiterIdがないユーザーは403を返す", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { accountId: "acc-1", accountType: "USER" },
    });

    const { GET } = await import("@/app/api/recruiter/jobs/[id]/route");
    const response = await GET(createRequest("GET"), routeContext);

    expect(response.status).toBe(403);
  });

  it("他のリクルーターの求人にはアクセスできない（findFirstがnull）", async () => {
    mockGetServerSession.mockResolvedValue(otherRecruiterSession);
    mockPrisma.jobPosting.findFirst.mockResolvedValue(null);

    const { GET } = await import("@/app/api/recruiter/jobs/[id]/route");
    const response = await GET(createRequest("GET"), routeContext);

    expect(response.status).toBe(404);
    // where条件にOTHER_RECRUITER_IDが使われることを確認
    expect(mockPrisma.jobPosting.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: JOB_ID,
          recruiterId: OTHER_RECRUITER_ID,
        },
      }),
    );
  });
});

// ── PATCH Tests ────────────────────────────────────────────────────

describe("PATCH /api/recruiter/jobs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(recruiterSession);
    mockPrisma.jobPosting.findFirst.mockResolvedValue(mockJob);
    mockPrisma.jobPosting.update.mockResolvedValue({
      ...mockJob,
      title: "更新されたタイトル",
    });
  });

  it("求人を更新できる", async () => {
    const { PATCH } = await import("@/app/api/recruiter/jobs/[id]/route");
    const response = await PATCH(
      createRequest("PATCH", { title: "更新されたタイトル" }),
      routeContext,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.job.title).toBe("更新されたタイトル");
  });

  it("更新時にrecruiterId条件で所有権を確認する", async () => {
    const { PATCH } = await import("@/app/api/recruiter/jobs/[id]/route");
    await PATCH(createRequest("PATCH", { title: "テスト" }), routeContext);

    expect(mockPrisma.jobPosting.findFirst).toHaveBeenCalledWith({
      where: {
        id: JOB_ID,
        recruiterId: RECRUITER_ID,
      },
    });
  });

  it("正しいデータでupdateが呼ばれる", async () => {
    const updateData = {
      title: "バックエンドエンジニア",
      salaryMin: 6000000,
      skills: ["Go", "PostgreSQL"],
    };

    const { PATCH } = await import("@/app/api/recruiter/jobs/[id]/route");
    await PATCH(createRequest("PATCH", updateData), routeContext);

    expect(mockPrisma.jobPosting.update).toHaveBeenCalledWith({
      where: { id: JOB_ID },
      data: updateData,
    });
  });

  it("存在しない求人の更新は404を返す", async () => {
    mockPrisma.jobPosting.findFirst.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/recruiter/jobs/[id]/route");
    const response = await PATCH(
      createRequest("PATCH", { title: "テスト" }),
      routeContext,
    );

    expect(response.status).toBe(404);
    expect(mockPrisma.jobPosting.update).not.toHaveBeenCalled();
  });

  it("未認証の場合401を返す", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/recruiter/jobs/[id]/route");
    const response = await PATCH(
      createRequest("PATCH", { title: "テスト" }),
      routeContext,
    );

    expect(response.status).toBe(401);
  });

  // バリデーションテスト
  describe("バリデーション", () => {
    it("タイトルが空文字の場合400を返す", async () => {
      const { PATCH } = await import("@/app/api/recruiter/jobs/[id]/route");
      const response = await PATCH(
        createRequest("PATCH", { title: "" }),
        routeContext,
      );

      expect(response.status).toBe(400);
      expect(mockPrisma.jobPosting.update).not.toHaveBeenCalled();
    });

    it("タイトルが200文字超の場合400を返す", async () => {
      const { PATCH } = await import("@/app/api/recruiter/jobs/[id]/route");
      const response = await PATCH(
        createRequest("PATCH", { title: "あ".repeat(201) }),
        routeContext,
      );

      expect(response.status).toBe(400);
    });

    it("descriptionが10000文字超の場合400を返す", async () => {
      const { PATCH } = await import("@/app/api/recruiter/jobs/[id]/route");
      const response = await PATCH(
        createRequest("PATCH", { description: "あ".repeat(10001) }),
        routeContext,
      );

      expect(response.status).toBe(400);
    });

    it("無効なemploymentTypeの場合400を返す", async () => {
      const { PATCH } = await import("@/app/api/recruiter/jobs/[id]/route");
      const response = await PATCH(
        createRequest("PATCH", { employmentType: "INVALID" }),
        routeContext,
      );

      expect(response.status).toBe(400);
    });

    it("無効なstatusの場合400を返す", async () => {
      const { PATCH } = await import("@/app/api/recruiter/jobs/[id]/route");
      const response = await PATCH(
        createRequest("PATCH", { status: "DELETED" }),
        routeContext,
      );

      expect(response.status).toBe(400);
    });

    it("skillsが50件超の場合400を返す", async () => {
      const { PATCH } = await import("@/app/api/recruiter/jobs/[id]/route");
      const response = await PATCH(
        createRequest("PATCH", {
          skills: Array.from({ length: 51 }, (_, i) => `skill-${i}`),
        }),
        routeContext,
      );

      expect(response.status).toBe(400);
    });

    it("nullable項目にnullを設定できる", async () => {
      mockPrisma.jobPosting.update.mockResolvedValue({
        ...mockJob,
        requirements: null,
        salaryMin: null,
      });

      const { PATCH } = await import("@/app/api/recruiter/jobs/[id]/route");
      const response = await PATCH(
        createRequest("PATCH", {
          requirements: null,
          salaryMin: null,
        }),
        routeContext,
      );

      expect(response.status).toBe(200);
      expect(mockPrisma.jobPosting.update).toHaveBeenCalledWith({
        where: { id: JOB_ID },
        data: { requirements: null, salaryMin: null },
      });
    });

    it("有効なstatusを設定できる", async () => {
      mockPrisma.jobPosting.update.mockResolvedValue({
        ...mockJob,
        status: "PAUSED",
      });

      const { PATCH } = await import("@/app/api/recruiter/jobs/[id]/route");
      const response = await PATCH(
        createRequest("PATCH", { status: "PAUSED" }),
        routeContext,
      );

      expect(response.status).toBe(200);
    });
  });
});

// ── DELETE Tests ────────────────────────────────────────────────────

describe("DELETE /api/recruiter/jobs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(recruiterSession);
    mockPrisma.jobPosting.findFirst.mockResolvedValue(mockJob);
    mockPrisma.jobPosting.delete.mockResolvedValue(mockJob);
  });

  it("自分の求人を削除できる", async () => {
    const { DELETE } = await import("@/app/api/recruiter/jobs/[id]/route");
    const response = await DELETE(createRequest("DELETE"), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("削除時にrecruiterId条件で所有権を確認する", async () => {
    const { DELETE } = await import("@/app/api/recruiter/jobs/[id]/route");
    await DELETE(createRequest("DELETE"), routeContext);

    expect(mockPrisma.jobPosting.findFirst).toHaveBeenCalledWith({
      where: {
        id: JOB_ID,
        recruiterId: RECRUITER_ID,
      },
    });
    expect(mockPrisma.jobPosting.delete).toHaveBeenCalledWith({
      where: { id: JOB_ID },
    });
  });

  it("存在しない求人の削除は404を返す", async () => {
    mockPrisma.jobPosting.findFirst.mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/recruiter/jobs/[id]/route");
    const response = await DELETE(createRequest("DELETE"), routeContext);

    expect(response.status).toBe(404);
    expect(mockPrisma.jobPosting.delete).not.toHaveBeenCalled();
  });

  it("未認証の場合401を返す", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/recruiter/jobs/[id]/route");
    const response = await DELETE(createRequest("DELETE"), routeContext);

    expect(response.status).toBe(401);
    expect(mockPrisma.jobPosting.delete).not.toHaveBeenCalled();
  });

  it("recruiter権限がない場合403を返す", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { accountId: "acc-1", accountType: "USER" },
    });

    const { DELETE } = await import("@/app/api/recruiter/jobs/[id]/route");
    const response = await DELETE(createRequest("DELETE"), routeContext);

    expect(response.status).toBe(403);
    expect(mockPrisma.jobPosting.delete).not.toHaveBeenCalled();
  });
});
