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
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ── Constants ──────────────────────────────────────────────────────

const RECRUITER_ID = "recruiter-001";
const COMPANY_ID = "company-001";
const ACCOUNT_ID = "acc-1";
const WATCH_ID = "watch-001";
const JOB_ID = "job-001";

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
  id: WATCH_ID,
  recruiterId: RECRUITER_ID,
  jobId: JOB_ID,
  name: "フロントエンドエンジニア",
  skills: ["React", "TypeScript"],
  keywords: ["フロントエンド"],
  experienceLevel: "MID",
  locationPref: "東京",
  salaryMin: 5000000,
  isActive: true,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const mockWatchWithRelations = {
  ...mockWatch,
  job: { id: JOB_ID, title: "フロントエンドエンジニア募集" },
  notifications: [],
};

const routeContext = {
  params: Promise.resolve({ id: WATCH_ID }),
};

// ── Helpers ────────────────────────────────────────────────────────

function createGetRequest(): NextRequest {
  return new NextRequest(`http://localhost/api/recruiter/watches/${WATCH_ID}`, {
    method: "GET",
  });
}

function createPatchRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/recruiter/watches/${WATCH_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createDeleteRequest(): NextRequest {
  return new NextRequest(`http://localhost/api/recruiter/watches/${WATCH_ID}`, {
    method: "DELETE",
  });
}

// ── GET Tests ──────────────────────────────────────────────────────

describe("GET /api/recruiter/watches/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(recruiterSession);
  });

  it("ウォッチリスト詳細を返す", async () => {
    mockPrisma.candidateWatch.findFirst.mockResolvedValue(
      mockWatchWithRelations,
    );

    const { GET } = await import("@/app/api/recruiter/watches/[id]/route");
    const response = await GET(createGetRequest(), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.watch.id).toBe(WATCH_ID);
    expect(data.watch.name).toBe("フロントエンドエンジニア");
    expect(data.watch.job.title).toBe("フロントエンドエンジニア募集");
  });

  it("自分のrecruiterIdでフィルタする", async () => {
    mockPrisma.candidateWatch.findFirst.mockResolvedValue(
      mockWatchWithRelations,
    );

    const { GET } = await import("@/app/api/recruiter/watches/[id]/route");
    await GET(createGetRequest(), routeContext);

    expect(mockPrisma.candidateWatch.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: WATCH_ID, recruiterId: RECRUITER_ID },
      }),
    );
  });

  it("存在しないウォッチリストは404を返す", async () => {
    mockPrisma.candidateWatch.findFirst.mockResolvedValue(null);

    const { GET } = await import("@/app/api/recruiter/watches/[id]/route");
    const response = await GET(createGetRequest(), routeContext);

    expect(response.status).toBe(404);
  });

  it("未認証の場合401を返す", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { GET } = await import("@/app/api/recruiter/watches/[id]/route");
    const response = await GET(createGetRequest(), routeContext);

    expect(response.status).toBe(401);
  });

  it("recruiterIdがない場合403を返す", async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        accountId: ACCOUNT_ID,
        companyId: COMPANY_ID,
        accountType: "RECRUITER",
      },
    });

    const { GET } = await import("@/app/api/recruiter/watches/[id]/route");
    const response = await GET(createGetRequest(), routeContext);

    expect(response.status).toBe(403);
  });
});

// ── PATCH Tests ────────────────────────────────────────────────────

describe("PATCH /api/recruiter/watches/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(recruiterSession);
    mockPrisma.candidateWatch.findFirst.mockResolvedValue(mockWatch);
    mockPrisma.candidateWatch.updateMany.mockResolvedValue({ count: 1 });
  });

  it("ウォッチリストの名前を更新できる", async () => {
    const updatedWatch = { ...mockWatch, name: "バックエンドエンジニア" };
    // findFirst is called twice: once for existence check, once for returning updated data
    mockPrisma.candidateWatch.findFirst
      .mockResolvedValueOnce(mockWatch)
      .mockResolvedValueOnce(updatedWatch);

    const { PATCH } = await import("@/app/api/recruiter/watches/[id]/route");
    const response = await PATCH(
      createPatchRequest({ name: "バックエンドエンジニア" }),
      routeContext,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.watch.name).toBe("バックエンドエンジニア");
  });

  it("スキルを更新できる", async () => {
    const updatedWatch = { ...mockWatch, skills: ["Vue", "Nuxt"] };
    mockPrisma.candidateWatch.findFirst
      .mockResolvedValueOnce(mockWatch)
      .mockResolvedValueOnce(updatedWatch);

    const { PATCH } = await import("@/app/api/recruiter/watches/[id]/route");
    const response = await PATCH(
      createPatchRequest({ skills: ["Vue", "Nuxt"] }),
      routeContext,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.watch.skills).toEqual(["Vue", "Nuxt"]);
  });

  it("isActiveを更新できる", async () => {
    const updatedWatch = { ...mockWatch, isActive: false };
    mockPrisma.candidateWatch.findFirst
      .mockResolvedValueOnce(mockWatch)
      .mockResolvedValueOnce(updatedWatch);

    const { PATCH } = await import("@/app/api/recruiter/watches/[id]/route");
    const response = await PATCH(
      createPatchRequest({ isActive: false }),
      routeContext,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.watch.isActive).toBe(false);
  });

  it("recruiterId条件付きupdateManyで所有権を検証する（TOCTOU防止）", async () => {
    mockPrisma.candidateWatch.findFirst
      .mockResolvedValueOnce(mockWatch)
      .mockResolvedValueOnce(mockWatch);

    const { PATCH } = await import("@/app/api/recruiter/watches/[id]/route");
    await PATCH(createPatchRequest({ name: "新しい名前" }), routeContext);

    expect(mockPrisma.candidateWatch.updateMany).toHaveBeenCalledWith({
      where: { id: WATCH_ID, recruiterId: RECRUITER_ID },
      data: { name: "新しい名前" },
    });
  });

  it("同時リクエストで既に削除済みなら404を返す", async () => {
    mockPrisma.candidateWatch.updateMany.mockResolvedValue({ count: 0 });

    const { PATCH } = await import("@/app/api/recruiter/watches/[id]/route");
    const response = await PATCH(
      createPatchRequest({ name: "新しい名前" }),
      routeContext,
    );

    expect(response.status).toBe(404);
  });

  it("存在しないウォッチリストは404を返す", async () => {
    mockPrisma.candidateWatch.findFirst.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/recruiter/watches/[id]/route");
    const response = await PATCH(
      createPatchRequest({ name: "新しい名前" }),
      routeContext,
    );

    expect(response.status).toBe(404);
    expect(mockPrisma.candidateWatch.updateMany).not.toHaveBeenCalled();
  });

  it("無効なバリデーションで400を返す", async () => {
    const { PATCH } = await import("@/app/api/recruiter/watches/[id]/route");
    const response = await PATCH(
      createPatchRequest({ name: "" }), // min(1)に違反
      routeContext,
    );

    expect(response.status).toBe(400);
    expect(mockPrisma.candidateWatch.findFirst).not.toHaveBeenCalled();
  });

  it("未認証の場合401を返す", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/recruiter/watches/[id]/route");
    const response = await PATCH(
      createPatchRequest({ name: "新しい名前" }),
      routeContext,
    );

    expect(response.status).toBe(401);
  });
});

// ── DELETE Tests ────────────────────────────────────────────────────

describe("DELETE /api/recruiter/watches/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(recruiterSession);
    mockPrisma.candidateWatch.findFirst.mockResolvedValue(mockWatch);
    mockPrisma.candidateWatch.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("ウォッチリストを削除できる", async () => {
    const { DELETE } = await import("@/app/api/recruiter/watches/[id]/route");
    const response = await DELETE(createDeleteRequest(), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("recruiterId条件付きdeleteManyで所有権を検証する（TOCTOU防止）", async () => {
    const { DELETE } = await import("@/app/api/recruiter/watches/[id]/route");
    await DELETE(createDeleteRequest(), routeContext);

    expect(mockPrisma.candidateWatch.deleteMany).toHaveBeenCalledWith({
      where: { id: WATCH_ID, recruiterId: RECRUITER_ID },
    });
  });

  it("同時リクエストで既に削除済みなら404を返す", async () => {
    mockPrisma.candidateWatch.deleteMany.mockResolvedValue({ count: 0 });

    const { DELETE } = await import("@/app/api/recruiter/watches/[id]/route");
    const response = await DELETE(createDeleteRequest(), routeContext);

    expect(response.status).toBe(404);
  });

  it("存在しないウォッチリストは404を返す", async () => {
    mockPrisma.candidateWatch.findFirst.mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/recruiter/watches/[id]/route");
    const response = await DELETE(createDeleteRequest(), routeContext);

    expect(response.status).toBe(404);
    expect(mockPrisma.candidateWatch.deleteMany).not.toHaveBeenCalled();
  });

  it("未認証の場合401を返す", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/recruiter/watches/[id]/route");
    const response = await DELETE(createDeleteRequest(), routeContext);

    expect(response.status).toBe(401);
  });

  it("自分のrecruiterIdでフィルタする", async () => {
    const { DELETE } = await import("@/app/api/recruiter/watches/[id]/route");
    await DELETE(createDeleteRequest(), routeContext);

    expect(mockPrisma.candidateWatch.findFirst).toHaveBeenCalledWith({
      where: { id: WATCH_ID, recruiterId: RECRUITER_ID },
    });
  });
});
