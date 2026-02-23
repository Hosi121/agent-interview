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
  invite: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
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

const RECRUITER_ID = "recruiter-001";
const COMPANY_ID = "company-001";
const ACCOUNT_ID = "acc-1";
const INVITE_ID = "invite-001";

const ownerSession = {
  user: {
    accountId: ACCOUNT_ID,
    recruiterId: RECRUITER_ID,
    companyId: COMPANY_ID,
    accountType: "RECRUITER",
    recruiterStatus: "ACTIVE",
  },
};

const mockCompanyData = {
  company: { id: COMPANY_ID, name: "テスト企業" },
  recruiter: { id: RECRUITER_ID, role: "OWNER", companyId: COMPANY_ID },
};

const mockInvite = {
  id: INVITE_ID,
  email: "invited@example.com",
  role: "MEMBER",
  status: "PENDING",
  companyId: COMPANY_ID,
  token: "abc123",
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  invitedByAccountId: ACCOUNT_ID,
};

const routeContext = {
  params: Promise.resolve({ id: INVITE_ID }),
};

// ── Helpers ────────────────────────────────────────────────────────

function createPatchRequest(body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/recruiter/invites/${INVITE_ID}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

// ── PATCH Tests ────────────────────────────────────────────────────

describe("PATCH /api/recruiter/invites/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(ownerSession);
    mockGetRecruiterWithCompany.mockResolvedValue(mockCompanyData);
    mockCanManageMembers.mockReturnValue(true);
    mockPrisma.invite.findFirst.mockResolvedValue(mockInvite);
    mockPrisma.invite.updateMany.mockResolvedValue({ count: 1 });
  });

  it("招待をREVOKEDに更新できる", async () => {
    const { PATCH } = await import("@/app/api/recruiter/invites/[id]/route");
    const response = await PATCH(
      createPatchRequest({ status: "REVOKED" }),
      routeContext,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe(INVITE_ID);
    expect(data.status).toBe("REVOKED");
  });

  it("同じcompanyIdの招待のみ取得する", async () => {
    const { PATCH } = await import("@/app/api/recruiter/invites/[id]/route");
    await PATCH(createPatchRequest({ status: "REVOKED" }), routeContext);

    expect(mockPrisma.invite.findFirst).toHaveBeenCalledWith({
      where: { id: INVITE_ID, companyId: COMPANY_ID },
    });
  });

  it("条件付きupdateManyで更新する（TOCTOU防止）", async () => {
    const { PATCH } = await import("@/app/api/recruiter/invites/[id]/route");
    await PATCH(createPatchRequest({ status: "REVOKED" }), routeContext);

    expect(mockPrisma.invite.updateMany).toHaveBeenCalledWith({
      where: { id: INVITE_ID, status: "PENDING" },
      data: { status: "REVOKED" },
    });
  });

  it("同時リクエストでステータス変更済みなら409を返す", async () => {
    mockPrisma.invite.updateMany.mockResolvedValue({ count: 0 });

    const { PATCH } = await import("@/app/api/recruiter/invites/[id]/route");
    const response = await PATCH(
      createPatchRequest({ status: "REVOKED" }),
      routeContext,
    );

    expect(response.status).toBe(409);
  });

  it("PENDING以外のステータスの招待は409を返す", async () => {
    mockPrisma.invite.findFirst.mockResolvedValue({
      ...mockInvite,
      status: "USED",
    });

    const { PATCH } = await import("@/app/api/recruiter/invites/[id]/route");
    const response = await PATCH(
      createPatchRequest({ status: "REVOKED" }),
      routeContext,
    );

    expect(response.status).toBe(409);
    expect(mockPrisma.invite.updateMany).not.toHaveBeenCalled();
  });

  it("REVOKED済みの招待は409を返す", async () => {
    mockPrisma.invite.findFirst.mockResolvedValue({
      ...mockInvite,
      status: "REVOKED",
    });

    const { PATCH } = await import("@/app/api/recruiter/invites/[id]/route");
    const response = await PATCH(
      createPatchRequest({ status: "REVOKED" }),
      routeContext,
    );

    expect(response.status).toBe(409);
    expect(mockPrisma.invite.updateMany).not.toHaveBeenCalled();
  });

  it("未認証の場合401を返す", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/recruiter/invites/[id]/route");
    const response = await PATCH(
      createPatchRequest({ status: "REVOKED" }),
      routeContext,
    );

    expect(response.status).toBe(401);
  });

  it("recruiterIdがない場合403を返す", async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        accountId: ACCOUNT_ID,
        accountType: "RECRUITER",
        recruiterStatus: "ACTIVE",
      },
    });

    const { PATCH } = await import("@/app/api/recruiter/invites/[id]/route");
    const response = await PATCH(
      createPatchRequest({ status: "REVOKED" }),
      routeContext,
    );

    expect(response.status).toBe(403);
  });

  it("権限がない場合403を返す", async () => {
    mockCanManageMembers.mockReturnValue(false);

    const { PATCH } = await import("@/app/api/recruiter/invites/[id]/route");
    const response = await PATCH(
      createPatchRequest({ status: "REVOKED" }),
      routeContext,
    );

    expect(response.status).toBe(403);
  });

  it("招待が見つからない場合404を返す", async () => {
    mockPrisma.invite.findFirst.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/recruiter/invites/[id]/route");
    const response = await PATCH(
      createPatchRequest({ status: "REVOKED" }),
      routeContext,
    );

    expect(response.status).toBe(404);
  });

  it("無効なステータスで400を返す", async () => {
    const { PATCH } = await import("@/app/api/recruiter/invites/[id]/route");
    const response = await PATCH(
      createPatchRequest({ status: "ACTIVE" }),
      routeContext,
    );

    expect(response.status).toBe(400);
  });

  it("ステータスなしで400を返す", async () => {
    const { PATCH } = await import("@/app/api/recruiter/invites/[id]/route");
    const response = await PATCH(createPatchRequest({}), routeContext);

    expect(response.status).toBe(400);
  });

  it("他の会社の招待はfindFirstで見つからず404を返す", async () => {
    const otherCompanySession = {
      user: {
        accountId: "acc-2",
        recruiterId: "recruiter-999",
        companyId: "company-999",
        accountType: "RECRUITER",
        recruiterStatus: "ACTIVE",
      },
    };
    mockGetServerSession.mockResolvedValue(otherCompanySession);
    mockGetRecruiterWithCompany.mockResolvedValue({
      company: { id: "company-999", name: "他社" },
      recruiter: {
        id: "recruiter-999",
        role: "OWNER",
        companyId: "company-999",
      },
    });
    mockPrisma.invite.findFirst.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/recruiter/invites/[id]/route");
    const response = await PATCH(
      createPatchRequest({ status: "REVOKED" }),
      routeContext,
    );

    expect(response.status).toBe(404);
    expect(mockPrisma.invite.findFirst).toHaveBeenCalledWith({
      where: { id: INVITE_ID, companyId: "company-999" },
    });
  });
});
