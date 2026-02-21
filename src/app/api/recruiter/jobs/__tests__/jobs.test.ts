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
    findMany: vi.fn(),
    create: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ── Constants ──────────────────────────────────────────────────────

const RECRUITER_ID = "recruiter-001";
const COMPANY_ID = "company-001";
const ACCOUNT_ID = "acc-1";

const recruiterSession = {
  user: {
    accountId: ACCOUNT_ID,
    recruiterId: RECRUITER_ID,
    companyId: COMPANY_ID,
    accountType: "RECRUITER",
    recruiterStatus: "ACTIVE",
  },
};

const mockJob = {
  id: "job-001",
  recruiterId: RECRUITER_ID,
  title: "フロントエンドエンジニア",
  description: "React/TypeScript開発",
  requirements: "3年以上の経験",
  preferredSkills: "Next.js",
  skills: ["React", "TypeScript"],
  keywords: ["フロントエンド"],
  employmentType: "FULL_TIME",
  experienceLevel: "MID",
  location: "東京",
  salaryMin: 5000000,
  salaryMax: 8000000,
  isRemote: true,
  status: "DRAFT",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  _count: { matches: 3, pipelines: 2 },
};

const validJobBody = {
  title: "フロントエンドエンジニア",
  description: "React/TypeScript開発",
  employmentType: "FULL_TIME" as const,
  experienceLevel: "MID" as const,
};

// ── Helpers ────────────────────────────────────────────────────────

function createGetRequest(queryString = ""): NextRequest {
  return new NextRequest(`http://localhost/api/recruiter/jobs${queryString}`, {
    method: "GET",
  });
}

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/recruiter/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── GET Tests ──────────────────────────────────────────────────────

describe("GET /api/recruiter/jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(recruiterSession);
  });

  it("求人一覧を返す", async () => {
    mockPrisma.jobPosting.findMany.mockResolvedValue([mockJob]);

    const { GET } = await import("@/app/api/recruiter/jobs/route");
    const response = await GET(createGetRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.jobs).toHaveLength(1);
    expect(data.jobs[0].title).toBe("フロントエンドエンジニア");
    expect(data.jobs[0]._count.matches).toBe(3);
    expect(data.jobs[0]._count.pipelines).toBe(2);
  });

  it("自分のrecruiterIdでフィルタする", async () => {
    mockPrisma.jobPosting.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/recruiter/jobs/route");
    await GET(createGetRequest());

    expect(mockPrisma.jobPosting.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          recruiterId: RECRUITER_ID,
        }),
      }),
    );
  });

  it("statusパラメータでフィルタできる", async () => {
    mockPrisma.jobPosting.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/recruiter/jobs/route");
    await GET(createGetRequest("?status=ACTIVE"));

    expect(mockPrisma.jobPosting.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          recruiterId: RECRUITER_ID,
          status: "ACTIVE",
        }),
      }),
    );
  });

  it("statusなしの場合はステータスフィルタなし", async () => {
    mockPrisma.jobPosting.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/recruiter/jobs/route");
    await GET(createGetRequest());

    const callArgs = mockPrisma.jobPosting.findMany.mock.calls[0][0];
    expect(callArgs.where.status).toBeUndefined();
  });

  it("空の求人リストを返す", async () => {
    mockPrisma.jobPosting.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/recruiter/jobs/route");
    const response = await GET(createGetRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.jobs).toEqual([]);
  });

  it("updatedAtの降順でソートする", async () => {
    mockPrisma.jobPosting.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/recruiter/jobs/route");
    await GET(createGetRequest());

    expect(mockPrisma.jobPosting.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { updatedAt: "desc" },
      }),
    );
  });

  it("未認証の場合401を返す", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { GET } = await import("@/app/api/recruiter/jobs/route");
    const response = await GET(createGetRequest());

    expect(response.status).toBe(401);
  });

  it("recruiterIdがない場合403を返す", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { accountId: ACCOUNT_ID, companyId: COMPANY_ID },
    });

    const { GET } = await import("@/app/api/recruiter/jobs/route");
    const response = await GET(createGetRequest());

    expect(response.status).toBe(403);
  });
});

// ── POST Tests ─────────────────────────────────────────────────────

describe("POST /api/recruiter/jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(recruiterSession);
    mockPrisma.jobPosting.create.mockResolvedValue(mockJob);
  });

  it("求人を作成して201を返す", async () => {
    const { POST } = await import("@/app/api/recruiter/jobs/route");
    const response = await POST(createPostRequest(validJobBody));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.job).toBeDefined();
  });

  it("recruiterIdを含めて作成する", async () => {
    const { POST } = await import("@/app/api/recruiter/jobs/route");
    await POST(createPostRequest(validJobBody));

    expect(mockPrisma.jobPosting.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recruiterId: RECRUITER_ID,
        title: "フロントエンドエンジニア",
        description: "React/TypeScript開発",
        employmentType: "FULL_TIME",
        experienceLevel: "MID",
      }),
    });
  });

  it("全フィールドを含むリクエストで作成できる", async () => {
    const fullBody = {
      ...validJobBody,
      requirements: "3年以上の経験",
      preferredSkills: "Next.js経験",
      skills: ["React", "TypeScript"],
      keywords: ["フロントエンド"],
      location: "東京",
      salaryMin: 5000000,
      salaryMax: 8000000,
      isRemote: true,
      status: "ACTIVE",
    };

    const { POST } = await import("@/app/api/recruiter/jobs/route");
    const response = await POST(createPostRequest(fullBody));

    expect(response.status).toBe(201);
    expect(mockPrisma.jobPosting.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recruiterId: RECRUITER_ID,
        requirements: "3年以上の経験",
        skills: ["React", "TypeScript"],
        isRemote: true,
        status: "ACTIVE",
      }),
    });
  });

  it("デフォルト値が適用される（skills=[], keywords=[], isRemote=false, status=DRAFT）", async () => {
    const { POST } = await import("@/app/api/recruiter/jobs/route");
    await POST(createPostRequest(validJobBody));

    expect(mockPrisma.jobPosting.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        skills: [],
        keywords: [],
        isRemote: false,
        status: "DRAFT",
      }),
    });
  });

  it("タイトルなしで400を返す", async () => {
    const { POST } = await import("@/app/api/recruiter/jobs/route");
    const response = await POST(
      createPostRequest({
        description: "説明",
        employmentType: "FULL_TIME",
        experienceLevel: "MID",
      }),
    );

    expect(response.status).toBe(400);
    expect(mockPrisma.jobPosting.create).not.toHaveBeenCalled();
  });

  it("説明なしで400を返す", async () => {
    const { POST } = await import("@/app/api/recruiter/jobs/route");
    const response = await POST(
      createPostRequest({
        title: "タイトル",
        employmentType: "FULL_TIME",
        experienceLevel: "MID",
      }),
    );

    expect(response.status).toBe(400);
  });

  it("無効な雇用形態で400を返す", async () => {
    const { POST } = await import("@/app/api/recruiter/jobs/route");
    const response = await POST(
      createPostRequest({
        ...validJobBody,
        employmentType: "INVALID",
      }),
    );

    expect(response.status).toBe(400);
  });

  it("無効な経験レベルで400を返す", async () => {
    const { POST } = await import("@/app/api/recruiter/jobs/route");
    const response = await POST(
      createPostRequest({
        ...validJobBody,
        experienceLevel: "INVALID",
      }),
    );

    expect(response.status).toBe(400);
  });

  it("タイトルが200文字を超えると400を返す", async () => {
    const { POST } = await import("@/app/api/recruiter/jobs/route");
    const response = await POST(
      createPostRequest({
        ...validJobBody,
        title: "a".repeat(201),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("未認証の場合401を返す", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { POST } = await import("@/app/api/recruiter/jobs/route");
    const response = await POST(createPostRequest(validJobBody));

    expect(response.status).toBe(401);
  });

  it("recruiterIdがない場合403を返す", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { accountId: ACCOUNT_ID, companyId: COMPANY_ID },
    });

    const { POST } = await import("@/app/api/recruiter/jobs/route");
    const response = await POST(createPostRequest(validJobBody));

    expect(response.status).toBe(403);
  });

  it("全ての有効な雇用形態を受け入れる", async () => {
    const types = [
      "FULL_TIME",
      "PART_TIME",
      "CONTRACT",
      "INTERNSHIP",
      "FREELANCE",
    ];

    const { POST } = await import("@/app/api/recruiter/jobs/route");

    for (const employmentType of types) {
      vi.clearAllMocks();
      mockGetServerSession.mockResolvedValue(recruiterSession);
      mockPrisma.jobPosting.create.mockResolvedValue(mockJob);

      const response = await POST(
        createPostRequest({ ...validJobBody, employmentType }),
      );
      expect(response.status).toBe(201);
    }
  });

  it("全ての有効な経験レベルを受け入れる", async () => {
    const levels = ["ENTRY", "JUNIOR", "MID", "SENIOR", "LEAD"];

    const { POST } = await import("@/app/api/recruiter/jobs/route");

    for (const experienceLevel of levels) {
      vi.clearAllMocks();
      mockGetServerSession.mockResolvedValue(recruiterSession);
      mockPrisma.jobPosting.create.mockResolvedValue(mockJob);

      const response = await POST(
        createPostRequest({ ...validJobBody, experienceLevel }),
      );
      expect(response.status).toBe(201);
    }
  });
});
