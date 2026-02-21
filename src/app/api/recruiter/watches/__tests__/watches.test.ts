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
  candidateWatch: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  jobPosting: {
    findFirst: vi.fn(),
  },
  agentProfile: {
    findMany: vi.fn(),
  },
  watchNotification: {
    upsert: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ── Constants ──────────────────────────────────────────────────────

const RECRUITER_ID = "recruiter-001";
const COMPANY_ID = "company-001";
const ACCOUNT_ID = "acc-001";

const recruiterSession = {
  user: {
    accountId: ACCOUNT_ID,
    recruiterId: RECRUITER_ID,
    companyId: COMPANY_ID,
    accountType: "RECRUITER",
    recruiterStatus: "ACTIVE",
  },
};

const mockWatch = {
  id: "watch-001",
  recruiterId: RECRUITER_ID,
  name: "React開発者ウォッチ",
  jobId: null,
  skills: ["React", "TypeScript"],
  keywords: ["フロントエンド"],
  experienceLevel: "MID",
  locationPref: "東京",
  salaryMin: 5000000,
  isActive: true,
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-01-15"),
  job: null,
  _count: { notifications: 5 },
  notifications: [{ id: "notif-1" }, { id: "notif-2" }],
};

const mockWatchCreated = {
  id: "watch-002",
  recruiterId: RECRUITER_ID,
  name: "新規ウォッチ",
  jobId: null,
  skills: [],
  keywords: [],
  experienceLevel: null,
  locationPref: null,
  salaryMin: null,
  isActive: true,
  createdAt: new Date("2024-01-16"),
  updatedAt: new Date("2024-01-16"),
  job: null,
};

const validBody = {
  name: "新規ウォッチ",
};

// ── Helpers ────────────────────────────────────────────────────────

function createGetRequest(queryString = ""): NextRequest {
  return new NextRequest(
    `http://localhost/api/recruiter/watches${queryString}`,
    { method: "GET" },
  );
}

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/recruiter/watches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── GET Tests ──────────────────────────────────────────────────────

describe("GET /api/recruiter/watches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(recruiterSession);
  });

  it("ウォッチリスト一覧を返す", async () => {
    mockPrisma.candidateWatch.findMany.mockResolvedValue([mockWatch]);

    const { GET } = await import("@/app/api/recruiter/watches/route");
    const response = await GET(createGetRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.watches).toHaveLength(1);
    expect(data.watches[0].name).toBe("React開発者ウォッチ");
  });

  it("unreadCountを未読通知数から計算する", async () => {
    mockPrisma.candidateWatch.findMany.mockResolvedValue([mockWatch]);

    const { GET } = await import("@/app/api/recruiter/watches/route");
    const response = await GET(createGetRequest());
    const data = await response.json();

    expect(data.watches[0].unreadCount).toBe(2);
    expect(data.watches[0]._count.notifications).toBe(5);
  });

  it("レスポンスからnotifications配列を除去する", async () => {
    mockPrisma.candidateWatch.findMany.mockResolvedValue([mockWatch]);

    const { GET } = await import("@/app/api/recruiter/watches/route");
    const response = await GET(createGetRequest());
    const data = await response.json();

    expect(data.watches[0].notifications).toBeUndefined();
  });

  it("自分のrecruiterIdでフィルタする", async () => {
    mockPrisma.candidateWatch.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/recruiter/watches/route");
    await GET(createGetRequest());

    expect(mockPrisma.candidateWatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { recruiterId: RECRUITER_ID },
      }),
    );
  });

  it("createdAtの降順でソートする", async () => {
    mockPrisma.candidateWatch.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/recruiter/watches/route");
    await GET(createGetRequest());

    expect(mockPrisma.candidateWatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("job情報をincludeする", async () => {
    const watchWithJob = {
      ...mockWatch,
      jobId: "job-001",
      job: { id: "job-001", title: "フロントエンドエンジニア" },
    };
    mockPrisma.candidateWatch.findMany.mockResolvedValue([watchWithJob]);

    const { GET } = await import("@/app/api/recruiter/watches/route");
    const response = await GET(createGetRequest());
    const data = await response.json();

    expect(data.watches[0].job).toEqual({
      id: "job-001",
      title: "フロントエンドエンジニア",
    });
  });

  it("空のウォッチリストを返す", async () => {
    mockPrisma.candidateWatch.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/recruiter/watches/route");
    const response = await GET(createGetRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.watches).toEqual([]);
  });

  it("未認証の場合401を返す", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { GET } = await import("@/app/api/recruiter/watches/route");
    const response = await GET(createGetRequest());

    expect(response.status).toBe(401);
  });

  it("recruiterIdがない場合403を返す", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { accountId: ACCOUNT_ID, companyId: COMPANY_ID },
    });

    const { GET } = await import("@/app/api/recruiter/watches/route");
    const response = await GET(createGetRequest());

    expect(response.status).toBe(403);
  });
});

// ── POST Tests ─────────────────────────────────────────────────────

describe("POST /api/recruiter/watches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(recruiterSession);
    mockPrisma.candidateWatch.create.mockResolvedValue(mockWatchCreated);
    // マッチング処理のモック（checkExistingAgentsForWatch）
    mockPrisma.candidateWatch.findUnique.mockResolvedValue({
      ...mockWatchCreated,
      isActive: true,
      recruiter: { companyId: COMPANY_ID },
    });
    mockPrisma.agentProfile.findMany.mockResolvedValue([]);
  });

  it("ウォッチを作成して201を返す", async () => {
    const { POST } = await import("@/app/api/recruiter/watches/route");
    const response = await POST(createPostRequest(validBody));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.watch).toBeDefined();
    expect(data.watch.name).toBe("新規ウォッチ");
  });

  it("recruiterIdを含めて作成する", async () => {
    const { POST } = await import("@/app/api/recruiter/watches/route");
    await POST(createPostRequest(validBody));

    expect(mockPrisma.candidateWatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recruiterId: RECRUITER_ID,
          name: "新規ウォッチ",
        }),
      }),
    );
  });

  it("全フィールドを含むリクエストで作成できる", async () => {
    const fullBody = {
      name: "フルウォッチ",
      jobId: "job-001",
      skills: ["React", "TypeScript"],
      keywords: ["フロントエンド", "SPA"],
      experienceLevel: "SENIOR",
      locationPref: "東京・大阪",
      salaryMin: 8000000,
    };
    mockPrisma.jobPosting.findFirst.mockResolvedValue({
      id: "job-001",
      recruiterId: RECRUITER_ID,
    });
    mockPrisma.candidateWatch.create.mockResolvedValue({
      ...mockWatchCreated,
      ...fullBody,
      job: { id: "job-001", title: "テスト求人" },
    });

    const { POST } = await import("@/app/api/recruiter/watches/route");
    const response = await POST(createPostRequest(fullBody));

    expect(response.status).toBe(201);
    expect(mockPrisma.candidateWatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recruiterId: RECRUITER_ID,
          name: "フルウォッチ",
          skills: ["React", "TypeScript"],
          keywords: ["フロントエンド", "SPA"],
          experienceLevel: "SENIOR",
          locationPref: "東京・大阪",
          salaryMin: 8000000,
          jobId: "job-001",
        }),
      }),
    );
  });

  it("デフォルト値が適用される（skills=[], keywords=[]）", async () => {
    const { POST } = await import("@/app/api/recruiter/watches/route");
    await POST(createPostRequest(validBody));

    expect(mockPrisma.candidateWatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          skills: [],
          keywords: [],
        }),
      }),
    );
  });

  it("jobIdが指定された場合、求人の所有権を確認する", async () => {
    mockPrisma.jobPosting.findFirst.mockResolvedValue({
      id: "job-001",
      recruiterId: RECRUITER_ID,
    });

    const { POST } = await import("@/app/api/recruiter/watches/route");
    await POST(createPostRequest({ ...validBody, jobId: "job-001" }));

    expect(mockPrisma.jobPosting.findFirst).toHaveBeenCalledWith({
      where: {
        id: "job-001",
        recruiterId: RECRUITER_ID,
      },
    });
  });

  it("存在しないjobIdで404を返す", async () => {
    mockPrisma.jobPosting.findFirst.mockResolvedValue(null);

    const { POST } = await import("@/app/api/recruiter/watches/route");
    const response = await POST(
      createPostRequest({ ...validBody, jobId: "nonexistent-job" }),
    );

    expect(response.status).toBe(404);
    expect(mockPrisma.candidateWatch.create).not.toHaveBeenCalled();
  });

  it("他のリクルーターの求人IDで404を返す", async () => {
    mockPrisma.jobPosting.findFirst.mockResolvedValue(null); // recruiterId不一致

    const { POST } = await import("@/app/api/recruiter/watches/route");
    const response = await POST(
      createPostRequest({ ...validBody, jobId: "other-recruiter-job" }),
    );

    expect(response.status).toBe(404);
    expect(mockPrisma.candidateWatch.create).not.toHaveBeenCalled();
  });

  it("jobIdなしの場合は求人チェックをスキップする", async () => {
    const { POST } = await import("@/app/api/recruiter/watches/route");
    await POST(createPostRequest(validBody));

    expect(mockPrisma.jobPosting.findFirst).not.toHaveBeenCalled();
  });

  it("job情報をincludeして返す", async () => {
    const { POST } = await import("@/app/api/recruiter/watches/route");
    await POST(createPostRequest(validBody));

    expect(mockPrisma.candidateWatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          job: {
            select: { id: true, title: true },
          },
        },
      }),
    );
  });

  // ── バックグラウンドマッチング ──────────────────────────────────

  it("作成後に既存エージェントとのマッチングを実行する", async () => {
    const { POST } = await import("@/app/api/recruiter/watches/route");
    await POST(createPostRequest(validBody));

    // checkExistingAgentsForWatch がwatchIdで呼ばれたことを確認
    expect(mockPrisma.candidateWatch.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockWatchCreated.id },
      }),
    );
  });

  it("マッチング処理が失敗してもウォッチ作成は成功する", async () => {
    mockPrisma.candidateWatch.findUnique.mockRejectedValue(
      new Error("マッチング処理エラー"),
    );

    const { POST } = await import("@/app/api/recruiter/watches/route");
    const response = await POST(createPostRequest(validBody));

    expect(response.status).toBe(201);
    expect(mockLogger.error).toHaveBeenCalledWith(
      "ウォッチ作成後のマッチング処理に失敗しました",
      expect.any(Error),
      expect.objectContaining({ watchId: mockWatchCreated.id }),
    );
  });

  it("マッチするエージェントがいた場合通知を作成する", async () => {
    // マッチスコア0.5以上になるエージェントをセットアップ
    mockPrisma.candidateWatch.findUnique.mockResolvedValue({
      id: mockWatchCreated.id,
      skills: ["React"],
      keywords: [],
      experienceLevel: null,
      isActive: true,
      recruiter: { companyId: COMPANY_ID },
    });
    mockPrisma.agentProfile.findMany.mockResolvedValue([
      {
        id: "agent-001",
        user: {
          fragments: [{ skills: ["React", "TypeScript"], keywords: [] }],
        },
      },
    ]);
    mockPrisma.watchNotification.upsert.mockResolvedValue({});

    const { POST } = await import("@/app/api/recruiter/watches/route");
    await POST(
      createPostRequest({ name: "スキルウォッチ", skills: ["React"] }),
    );

    expect(mockPrisma.watchNotification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          watchId_agentId: {
            watchId: mockWatchCreated.id,
            agentId: "agent-001",
          },
        },
        create: expect.objectContaining({
          watchId: mockWatchCreated.id,
          agentId: "agent-001",
        }),
      }),
    );
  });

  it("非アクティブなウォッチではマッチングをスキップする", async () => {
    mockPrisma.candidateWatch.findUnique.mockResolvedValue({
      ...mockWatchCreated,
      isActive: false,
      recruiter: { companyId: COMPANY_ID },
    });

    const { POST } = await import("@/app/api/recruiter/watches/route");
    await POST(createPostRequest(validBody));

    expect(mockPrisma.agentProfile.findMany).not.toHaveBeenCalled();
  });

  // ── バリデーション ────────────────────────────────────────────────

  it("名前なしで400を返す", async () => {
    const { POST } = await import("@/app/api/recruiter/watches/route");
    const response = await POST(createPostRequest({}));

    expect(response.status).toBe(400);
    expect(mockPrisma.candidateWatch.create).not.toHaveBeenCalled();
  });

  it("空の名前で400を返す", async () => {
    const { POST } = await import("@/app/api/recruiter/watches/route");
    const response = await POST(createPostRequest({ name: "" }));

    expect(response.status).toBe(400);
  });

  it("名前が200文字を超えると400を返す", async () => {
    const { POST } = await import("@/app/api/recruiter/watches/route");
    const response = await POST(createPostRequest({ name: "a".repeat(201) }));

    expect(response.status).toBe(400);
  });

  it("無効なexperienceLevelで400を返す", async () => {
    const { POST } = await import("@/app/api/recruiter/watches/route");
    const response = await POST(
      createPostRequest({ ...validBody, experienceLevel: "INVALID" }),
    );

    expect(response.status).toBe(400);
  });

  it("全ての有効なexperienceLevelを受け入れる", async () => {
    const levels = ["JUNIOR", "MID", "SENIOR", "LEAD"];

    const { POST } = await import("@/app/api/recruiter/watches/route");

    for (const experienceLevel of levels) {
      vi.clearAllMocks();
      mockGetServerSession.mockResolvedValue(recruiterSession);
      mockPrisma.candidateWatch.create.mockResolvedValue(mockWatchCreated);
      mockPrisma.candidateWatch.findUnique.mockResolvedValue({
        ...mockWatchCreated,
        isActive: true,
        recruiter: { companyId: COMPANY_ID },
      });
      mockPrisma.agentProfile.findMany.mockResolvedValue([]);

      const response = await POST(
        createPostRequest({ ...validBody, experienceLevel }),
      );
      expect(response.status).toBe(201);
    }
  });

  it("skillsが50個を超えると400を返す", async () => {
    const { POST } = await import("@/app/api/recruiter/watches/route");
    const response = await POST(
      createPostRequest({
        ...validBody,
        skills: Array.from({ length: 51 }, (_, i) => `skill-${i}`),
      }),
    );

    expect(response.status).toBe(400);
  });

  // ── 認証 ──────────────────────────────────────────────────────────

  it("未認証の場合401を返す", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { POST } = await import("@/app/api/recruiter/watches/route");
    const response = await POST(createPostRequest(validBody));

    expect(response.status).toBe(401);
  });

  it("recruiterIdがない場合403を返す", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { accountId: ACCOUNT_ID, companyId: COMPANY_ID },
    });

    const { POST } = await import("@/app/api/recruiter/watches/route");
    const response = await POST(createPostRequest(validBody));

    expect(response.status).toBe(403);
  });
});
