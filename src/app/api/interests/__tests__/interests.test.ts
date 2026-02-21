import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────

// Logger
const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
vi.mock("@/lib/logger", () => ({ logger: mockLogger }));

// NextAuth
const mockGetServerSession = vi.fn();
vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

// Prisma
const mockPrisma = {
  interest: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  agentProfile: {
    findUnique: vi.fn(),
  },
  companyAccess: {
    findUnique: vi.fn(),
  },
  notification: {
    create: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// Access control (uses prisma internally, but we mock it directly)
const mockIsCompanyAccessDenied = vi.fn();
vi.mock("@/lib/access-control", () => ({
  isCompanyAccessDenied: (...args: unknown[]) =>
    mockIsCompanyAccessDenied(...args),
}));

// ── Helpers ────────────────────────────────────────────────────────

const RECRUITER_ID = "rec-1";
const COMPANY_ID = "comp-1";
const USER_ID = "user-1";
const AGENT_ID = "agent-1";
const ACCOUNT_ID = "acc-user-1";

function recruiterSession() {
  return {
    user: {
      accountId: "acc-rec-1",
      accountType: "RECRUITER",
      recruiterId: RECRUITER_ID,
      companyId: COMPANY_ID,
      companyName: "テスト株式会社",
      companyRole: "OWNER",
      recruiterStatus: "ACTIVE",
    },
  };
}

function createGetRequest(): NextRequest {
  return new NextRequest("http://localhost/api/interests", {
    method: "GET",
  });
}

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/interests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Tests ──────────────────────────────────────────────────────────

describe("GET /api/interests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(recruiterSession());
    mockIsCompanyAccessDenied.mockResolvedValue(false);
  });

  it("認証済み採用担当者は興味表明一覧を取得できる", async () => {
    const { GET } = await import("@/app/api/interests/route");
    mockPrisma.interest.findMany.mockResolvedValue([
      {
        id: "int-1",
        recruiterId: RECRUITER_ID,
        userId: USER_ID,
        status: "INTERESTED",
        createdAt: new Date(),
        user: {
          id: USER_ID,
          name: "太郎",
          email: "taro@example.com",
          phone: "090-1234-5678",
          avatarPath: null,
          agent: { id: AGENT_ID, status: "PUBLIC" },
        },
      },
    ]);

    const res = await GET(createGetRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.interests).toHaveLength(1);
    expect(data.interests[0].id).toBe("int-1");
  });

  it("連絡先はCONTACT_DISCLOSEDの場合のみ返す", async () => {
    const { GET } = await import("@/app/api/interests/route");
    mockPrisma.interest.findMany.mockResolvedValue([
      {
        id: "int-1",
        status: "INTERESTED",
        user: {
          id: USER_ID,
          name: "太郎",
          email: "taro@example.com",
          phone: "090-1234-5678",
          avatarPath: null,
          agent: null,
        },
      },
      {
        id: "int-2",
        status: "CONTACT_DISCLOSED",
        user: {
          id: "user-2",
          name: "花子",
          email: "hanako@example.com",
          phone: "090-8765-4321",
          avatarPath: null,
          agent: null,
        },
      },
    ]);

    const res = await GET(createGetRequest());
    const data = await res.json();

    // INTERESTED → メール・電話はnull
    expect(data.interests[0].user.email).toBeNull();
    expect(data.interests[0].user.phone).toBeNull();

    // CONTACT_DISCLOSED → メール・電話が含まれる
    expect(data.interests[1].user.email).toBe("hanako@example.com");
    expect(data.interests[1].user.phone).toBe("090-8765-4321");
  });

  it("未認証の場合は401を返す", async () => {
    const { GET } = await import("@/app/api/interests/route");
    mockGetServerSession.mockResolvedValue(null);

    const res = await GET(createGetRequest());
    expect(res.status).toBe(401);
  });

  it("recruiterIdを持たないセッションは403を返す", async () => {
    const { GET } = await import("@/app/api/interests/route");
    mockGetServerSession.mockResolvedValue({
      user: {
        accountId: "acc-1",
        accountType: "USER",
        userId: USER_ID,
      },
    });

    const res = await GET(createGetRequest());
    expect(res.status).toBe(403);
  });
});

describe("POST /api/interests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(recruiterSession());
    mockIsCompanyAccessDenied.mockResolvedValue(false);
    mockPrisma.agentProfile.findUnique.mockResolvedValue({
      id: AGENT_ID,
      userId: USER_ID,
      status: "PUBLIC",
      user: { id: USER_ID, accountId: ACCOUNT_ID },
    });
    mockPrisma.interest.create.mockResolvedValue({
      id: "int-new",
      recruiterId: RECRUITER_ID,
      userId: USER_ID,
      agentId: AGENT_ID,
      message: null,
      status: "INTERESTED",
      user: { id: USER_ID, name: "太郎" },
    });
    mockPrisma.notification.create.mockResolvedValue({ id: "notif-1" });
  });

  // ── バリデーション ────────────────────────────────────────

  it("agentIdが空の場合は400を返す", async () => {
    const { POST } = await import("@/app/api/interests/route");
    const res = await POST(createPostRequest({ agentId: "" }));
    expect(res.status).toBe(400);
  });

  it("agentIdがない場合は400を返す", async () => {
    const { POST } = await import("@/app/api/interests/route");
    const res = await POST(createPostRequest({}));
    expect(res.status).toBe(400);
  });

  it("messageが2000文字を超える場合は400を返す", async () => {
    const { POST } = await import("@/app/api/interests/route");
    const res = await POST(
      createPostRequest({
        agentId: AGENT_ID,
        message: "a".repeat(2001),
      }),
    );
    expect(res.status).toBe(400);
  });

  // ── 正常系 ────────────────────────────────────────────────

  it("正常に興味表明でき201を返す", async () => {
    const { POST } = await import("@/app/api/interests/route");
    const res = await POST(createPostRequest({ agentId: AGENT_ID }));

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.interest.id).toBe("int-new");
    expect(data.interest.user.name).toBe("太郎");
  });

  it("メッセージ付きで興味表明できる", async () => {
    const { POST } = await import("@/app/api/interests/route");
    const res = await POST(
      createPostRequest({
        agentId: AGENT_ID,
        message: "ぜひお話ししたいです",
      }),
    );

    expect(res.status).toBe(201);
    expect(mockPrisma.interest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          message: "ぜひお話ししたいです",
        }),
      }),
    );
  });

  it("通知が正しく作成される", async () => {
    const { POST } = await import("@/app/api/interests/route");
    await POST(createPostRequest({ agentId: AGENT_ID }));

    expect(mockPrisma.notification.create).toHaveBeenCalledWith({
      data: {
        accountId: ACCOUNT_ID,
        type: "NEW_CANDIDATE_MATCH",
        title: "企業からの興味表明",
        body: "テスト株式会社があなたに興味を持っています",
        data: {
          interestId: "int-new",
          recruiterId: RECRUITER_ID,
          companyName: "テスト株式会社",
        },
      },
    });
  });

  // ── エラー系 ──────────────────────────────────────────────

  it("エージェントが存在しない場合は404を返す", async () => {
    const { POST } = await import("@/app/api/interests/route");
    mockPrisma.agentProfile.findUnique.mockResolvedValue(null);

    const res = await POST(createPostRequest({ agentId: "nonexistent" }));
    expect(res.status).toBe(404);
  });

  it("エージェントが非公開の場合は403を返す", async () => {
    const { POST } = await import("@/app/api/interests/route");
    mockPrisma.agentProfile.findUnique.mockResolvedValue({
      id: AGENT_ID,
      userId: USER_ID,
      status: "DRAFT",
      user: { id: USER_ID, accountId: ACCOUNT_ID },
    });

    const res = await POST(createPostRequest({ agentId: AGENT_ID }));
    expect(res.status).toBe(403);
  });

  it("企業アクセスが拒否されている場合は403を返す", async () => {
    const { POST } = await import("@/app/api/interests/route");
    mockIsCompanyAccessDenied.mockResolvedValue(true);

    const res = await POST(createPostRequest({ agentId: AGENT_ID }));
    expect(res.status).toBe(403);
    expect(mockIsCompanyAccessDenied).toHaveBeenCalledWith(COMPANY_ID, USER_ID);
  });

  it("重複興味表明（P2002）の場合は409を返す", async () => {
    const { POST } = await import("@/app/api/interests/route");
    mockPrisma.interest.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.0.0",
      }),
    );

    const res = await POST(createPostRequest({ agentId: AGENT_ID }));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain("興味表明済み");
  });

  it("P2002以外のPrismaエラーは500を返す", async () => {
    const { POST } = await import("@/app/api/interests/route");
    mockPrisma.interest.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Connection error", {
        code: "P1001",
        clientVersion: "6.0.0",
      }),
    );

    const res = await POST(createPostRequest({ agentId: AGENT_ID }));
    expect(res.status).toBe(500);
  });

  it("未認証の場合は401を返す", async () => {
    const { POST } = await import("@/app/api/interests/route");
    mockGetServerSession.mockResolvedValue(null);

    const res = await POST(createPostRequest({ agentId: AGENT_ID }));
    expect(res.status).toBe(401);
  });

  it("重複チェックではなくDB制約で重複を防止する（TOCTOU安全）", async () => {
    const { POST } = await import("@/app/api/interests/route");

    // findUniqueが呼ばれていないことを検証（findManyはGET用）
    await POST(createPostRequest({ agentId: AGENT_ID }));

    // interest.findUniqueは呼ばれず、直接createが呼ばれる
    expect(mockPrisma.interest.create).toHaveBeenCalledTimes(1);
    // agentProfile.findUniqueはエージェント存在確認用で正当
    expect(mockPrisma.agentProfile.findUnique).toHaveBeenCalledTimes(1);
  });

  it("companyNameがない場合はデフォルト値で通知を作成する", async () => {
    const { POST } = await import("@/app/api/interests/route");
    mockGetServerSession.mockResolvedValue({
      user: {
        ...recruiterSession().user,
        companyName: undefined,
      },
    });

    await POST(createPostRequest({ agentId: AGENT_ID }));

    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          body: "企業があなたに興味を持っています",
          data: expect.objectContaining({
            companyName: "企業",
          }),
        }),
      }),
    );
  });
});
