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
  recruiter: { findFirst: vi.fn() },
  invite: { create: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockGetRecruiterWithCompany = vi.fn();
const mockCanManageMembers = vi.fn();
vi.mock("@/lib/company", () => ({
  getRecruiterWithCompany: (...args: unknown[]) =>
    mockGetRecruiterWithCompany(...args),
  canManageMembers: (...args: unknown[]) => mockCanManageMembers(...args),
}));

// ── Constants ──────────────────────────────────────────────────────

const ACCOUNT_ID = "acc-001";
const RECRUITER_ID = "recruiter-001";
const COMPANY_ID = "company-001";

const recruiterSession = {
  user: {
    accountId: ACCOUNT_ID,
    recruiterId: RECRUITER_ID,
    companyId: COMPANY_ID,
    accountType: "RECRUITER",
    recruiterStatus: "ACTIVE",
  },
};

const mockCompany = {
  id: COMPANY_ID,
  name: "テスト株式会社",
  slug: "test-corp",
};

const mockRecruiter = {
  id: RECRUITER_ID,
  accountId: ACCOUNT_ID,
  companyId: COMPANY_ID,
  role: "OWNER",
  status: "ACTIVE",
};

const mockInvite = {
  id: "invite-001",
  token: "mock-token-abc123",
  companyId: COMPANY_ID,
  email: "newmember@example.com",
  role: "MEMBER",
  status: "PENDING",
  expiresAt: new Date("2024-01-22"),
  invitedByAccountId: ACCOUNT_ID,
  createdAt: new Date("2024-01-15"),
};

const validBody = {
  email: "newmember@example.com",
  role: "MEMBER" as const,
};

// ── Helpers ────────────────────────────────────────────────────────

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/recruiter/invites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── POST Tests ─────────────────────────────────────────────────────

describe("POST /api/recruiter/invites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(recruiterSession);
    mockGetRecruiterWithCompany.mockResolvedValue({
      company: mockCompany,
      recruiter: mockRecruiter,
    });
    mockCanManageMembers.mockReturnValue(true);
    mockPrisma.recruiter.findFirst.mockResolvedValue(null); // no existing member
    mockPrisma.invite.create.mockResolvedValue(mockInvite);
  });

  it("招待を作成して201を返す", async () => {
    const { POST } = await import("@/app/api/recruiter/invites/route");
    const response = await POST(createPostRequest(validBody));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.invite).toBeDefined();
    expect(data.acceptUrl).toContain("/invite/");
  });

  it("正しいデータでinvite.createを呼ぶ", async () => {
    const { POST } = await import("@/app/api/recruiter/invites/route");
    await POST(createPostRequest(validBody));

    expect(mockPrisma.invite.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: COMPANY_ID,
        email: "newmember@example.com",
        role: "MEMBER",
        invitedByAccountId: ACCOUNT_ID,
      }),
    });
  });

  it("トークンと有効期限を含めて作成する", async () => {
    const { POST } = await import("@/app/api/recruiter/invites/route");
    await POST(createPostRequest(validBody));

    const createCall = mockPrisma.invite.create.mock.calls[0][0];
    expect(createCall.data.token).toBeDefined();
    expect(typeof createCall.data.token).toBe("string");
    expect(createCall.data.token.length).toBeGreaterThan(0);
    expect(createCall.data.expiresAt).toBeInstanceOf(Date);
    // 有効期限が7日後であることを確認
    const now = Date.now();
    const expiresMs = createCall.data.expiresAt.getTime();
    const sevenDaysMs = 1000 * 60 * 60 * 24 * 7;
    expect(expiresMs - now).toBeGreaterThan(sevenDaysMs - 5000); // 5秒の余裕
    expect(expiresMs - now).toBeLessThan(sevenDaysMs + 5000);
  });

  it("acceptUrlにトークンを含む", async () => {
    const { POST } = await import("@/app/api/recruiter/invites/route");
    const response = await POST(createPostRequest(validBody));
    const data = await response.json();

    expect(data.acceptUrl).toMatch(/\/invite\/.+/);
  });

  it("ADMINロールの招待を作成できる", async () => {
    const { POST } = await import("@/app/api/recruiter/invites/route");
    const response = await POST(
      createPostRequest({ email: "admin@example.com", role: "ADMIN" }),
    );

    expect(response.status).toBe(201);
    expect(mockPrisma.invite.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        role: "ADMIN",
      }),
    });
  });

  it("getRecruiterWithCompanyにrecruiterIdを渡す", async () => {
    const { POST } = await import("@/app/api/recruiter/invites/route");
    await POST(createPostRequest(validBody));

    expect(mockGetRecruiterWithCompany).toHaveBeenCalledWith(RECRUITER_ID);
  });

  it("canManageMembersにロールを渡す", async () => {
    const { POST } = await import("@/app/api/recruiter/invites/route");
    await POST(createPostRequest(validBody));

    expect(mockCanManageMembers).toHaveBeenCalledWith("OWNER");
  });

  // ── 重複チェック ──────────────────────────────────────────────────

  it("既にメンバーの場合409を返す", async () => {
    mockPrisma.recruiter.findFirst.mockResolvedValue({
      id: "existing-recruiter",
      companyId: COMPANY_ID,
      status: "ACTIVE",
    });

    const { POST } = await import("@/app/api/recruiter/invites/route");
    const response = await POST(createPostRequest(validBody));

    expect(response.status).toBe(409);
    expect(mockPrisma.invite.create).not.toHaveBeenCalled();
  });

  it("既存メンバーチェックで正しいクエリを使う", async () => {
    const { POST } = await import("@/app/api/recruiter/invites/route");
    await POST(createPostRequest(validBody));

    expect(mockPrisma.recruiter.findFirst).toHaveBeenCalledWith({
      where: {
        companyId: COMPANY_ID,
        account: { email: "newmember@example.com" },
        status: "ACTIVE",
      },
    });
  });

  // ── 権限チェック ──────────────────────────────────────────────────

  it("メンバー管理権限がない場合403を返す", async () => {
    mockCanManageMembers.mockReturnValue(false);
    mockGetRecruiterWithCompany.mockResolvedValue({
      company: mockCompany,
      recruiter: { ...mockRecruiter, role: "MEMBER" },
    });

    const { POST } = await import("@/app/api/recruiter/invites/route");
    const response = await POST(createPostRequest(validBody));

    expect(response.status).toBe(403);
    expect(mockPrisma.invite.create).not.toHaveBeenCalled();
  });

  it("USERアカウントタイプの場合403を返す", async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        accountId: ACCOUNT_ID,
        accountType: "USER",
        userId: "user-001",
      },
    });

    const { POST } = await import("@/app/api/recruiter/invites/route");
    const response = await POST(createPostRequest(validBody));

    expect(response.status).toBe(403);
    expect(mockPrisma.invite.create).not.toHaveBeenCalled();
  });

  it("recruiterIdがない場合403を返す", async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        accountId: ACCOUNT_ID,
        accountType: "RECRUITER",
        // recruiterId missing
      },
    });

    const { POST } = await import("@/app/api/recruiter/invites/route");
    const response = await POST(createPostRequest(validBody));

    expect(response.status).toBe(403);
  });

  it("accountIdがない場合403を返す", async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        accountType: "RECRUITER",
        recruiterId: RECRUITER_ID,
        // accountId missing
      },
    });

    const { POST } = await import("@/app/api/recruiter/invites/route");
    const response = await POST(createPostRequest(validBody));

    expect(response.status).toBe(403);
  });

  // ── バリデーション ────────────────────────────────────────────────

  it("メールアドレスなしで400を返す", async () => {
    const { POST } = await import("@/app/api/recruiter/invites/route");
    const response = await POST(createPostRequest({ role: "MEMBER" }));

    expect(response.status).toBe(400);
    expect(mockPrisma.invite.create).not.toHaveBeenCalled();
  });

  it("無効なメールアドレスで400を返す", async () => {
    const { POST } = await import("@/app/api/recruiter/invites/route");
    const response = await POST(
      createPostRequest({ email: "invalid-email", role: "MEMBER" }),
    );

    expect(response.status).toBe(400);
  });

  it("ロールなしで400を返す", async () => {
    const { POST } = await import("@/app/api/recruiter/invites/route");
    const response = await POST(
      createPostRequest({ email: "test@example.com" }),
    );

    expect(response.status).toBe(400);
  });

  it("無効なロールで400を返す", async () => {
    const { POST } = await import("@/app/api/recruiter/invites/route");
    const response = await POST(
      createPostRequest({ email: "test@example.com", role: "OWNER" }),
    );

    expect(response.status).toBe(400);
  });

  // ── 認証 ──────────────────────────────────────────────────────────

  it("未認証の場合401を返す", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { POST } = await import("@/app/api/recruiter/invites/route");
    const response = await POST(createPostRequest(validBody));

    expect(response.status).toBe(401);
  });
});
