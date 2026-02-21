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
  recruiter: {
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
const TARGET_ID = "recruiter-002";
const COMPANY_ID = "company-001";
const ACCOUNT_ID = "acc-1";
const TARGET_ACCOUNT_ID = "acc-2";

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

const mockTarget = {
  id: TARGET_ID,
  accountId: TARGET_ACCOUNT_ID,
  role: "ADMIN",
  status: "ACTIVE",
  companyId: COMPANY_ID,
  account: { id: TARGET_ACCOUNT_ID, email: "target@example.com" },
};

const routeContext = {
  params: Promise.resolve({ id: TARGET_ID }),
};

// ── Helpers ────────────────────────────────────────────────────────

function createPatchRequest(body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/recruiter/members/${TARGET_ID}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function createDeleteRequest(): NextRequest {
  return new NextRequest(
    `http://localhost/api/recruiter/members/${TARGET_ID}`,
    { method: "DELETE" },
  );
}

// ── PATCH Tests ────────────────────────────────────────────────────

describe("PATCH /api/recruiter/members/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(ownerSession);
    mockGetRecruiterWithCompany.mockResolvedValue(mockCompanyData);
    mockCanManageMembers.mockReturnValue(true);
    mockPrisma.recruiter.findFirst.mockResolvedValue(mockTarget);
    mockPrisma.recruiter.updateMany.mockResolvedValue({ count: 1 });
  });

  it("メンバーのステータスを更新できる", async () => {
    const { PATCH } = await import("@/app/api/recruiter/members/[id]/route");
    const response = await PATCH(
      createPatchRequest({ status: "DISABLED" }),
      routeContext,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe(TARGET_ID);
    expect(data.status).toBe("DISABLED");
  });

  it("同じcompanyIdのメンバーのみ取得する", async () => {
    const { PATCH } = await import("@/app/api/recruiter/members/[id]/route");
    await PATCH(createPatchRequest({ status: "DISABLED" }), routeContext);

    expect(mockPrisma.recruiter.findFirst).toHaveBeenCalledWith({
      where: { id: TARGET_ID, companyId: COMPANY_ID },
      include: { account: true },
    });
  });

  it("ステータスが同じ場合は更新せず返す", async () => {
    const { PATCH } = await import("@/app/api/recruiter/members/[id]/route");
    const response = await PATCH(
      createPatchRequest({ status: "ACTIVE" }),
      routeContext,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("ACTIVE");
    expect(mockPrisma.recruiter.updateMany).not.toHaveBeenCalled();
  });

  it("未認証の場合401を返す", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/recruiter/members/[id]/route");
    const response = await PATCH(
      createPatchRequest({ status: "DISABLED" }),
      routeContext,
    );

    expect(response.status).toBe(401);
  });

  it("権限がない場合403を返す", async () => {
    mockCanManageMembers.mockReturnValue(false);

    const { PATCH } = await import("@/app/api/recruiter/members/[id]/route");
    const response = await PATCH(
      createPatchRequest({ status: "DISABLED" }),
      routeContext,
    );

    expect(response.status).toBe(403);
  });

  it("対象メンバーが見つからない場合404を返す", async () => {
    mockPrisma.recruiter.findFirst.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/recruiter/members/[id]/route");
    const response = await PATCH(
      createPatchRequest({ status: "DISABLED" }),
      routeContext,
    );

    expect(response.status).toBe(404);
  });

  it("自分自身のステータスは変更できない", async () => {
    mockPrisma.recruiter.findFirst.mockResolvedValue({
      ...mockTarget,
      accountId: ACCOUNT_ID, // 自分自身
    });

    const { PATCH } = await import("@/app/api/recruiter/members/[id]/route");
    const response = await PATCH(
      createPatchRequest({ status: "DISABLED" }),
      routeContext,
    );

    expect(response.status).toBe(409);
    expect(mockPrisma.recruiter.updateMany).not.toHaveBeenCalled();
  });

  it("非OWNERがOWNERのステータスを変更できない", async () => {
    mockGetRecruiterWithCompany.mockResolvedValue({
      ...mockCompanyData,
      recruiter: { ...mockCompanyData.recruiter, role: "ADMIN" },
    });
    mockPrisma.recruiter.findFirst.mockResolvedValue({
      ...mockTarget,
      role: "OWNER",
    });

    const { PATCH } = await import("@/app/api/recruiter/members/[id]/route");
    const response = await PATCH(
      createPatchRequest({ status: "DISABLED" }),
      routeContext,
    );

    expect(response.status).toBe(403);
    expect(mockPrisma.recruiter.updateMany).not.toHaveBeenCalled();
  });

  it("OWNERは他のOWNERのステータスを変更できる", async () => {
    mockPrisma.recruiter.findFirst.mockResolvedValue({
      ...mockTarget,
      role: "OWNER",
    });

    const { PATCH } = await import("@/app/api/recruiter/members/[id]/route");
    const response = await PATCH(
      createPatchRequest({ status: "DISABLED" }),
      routeContext,
    );

    expect(response.status).toBe(200);
  });

  it("条件付きupdateManyで更新する（TOCTOU防止）", async () => {
    const { PATCH } = await import("@/app/api/recruiter/members/[id]/route");
    await PATCH(createPatchRequest({ status: "DISABLED" }), routeContext);

    expect(mockPrisma.recruiter.updateMany).toHaveBeenCalledWith({
      where: { id: TARGET_ID, companyId: COMPANY_ID, status: "ACTIVE" },
      data: { status: "DISABLED" },
    });
  });

  it("同時リクエストでステータス変更済みなら409を返す", async () => {
    mockPrisma.recruiter.updateMany.mockResolvedValue({ count: 0 });

    const { PATCH } = await import("@/app/api/recruiter/members/[id]/route");
    const response = await PATCH(
      createPatchRequest({ status: "DISABLED" }),
      routeContext,
    );

    expect(response.status).toBe(409);
  });

  it("無効なステータスで400を返す", async () => {
    const { PATCH } = await import("@/app/api/recruiter/members/[id]/route");
    const response = await PATCH(
      createPatchRequest({ status: "INVALID" }),
      routeContext,
    );

    expect(response.status).toBe(400);
  });
});

// ── DELETE Tests ────────────────────────────────────────────────────

describe("DELETE /api/recruiter/members/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(ownerSession);
    mockGetRecruiterWithCompany.mockResolvedValue(mockCompanyData);
    mockCanManageMembers.mockReturnValue(true);
    mockPrisma.recruiter.findFirst.mockResolvedValue(mockTarget);
    mockPrisma.recruiter.updateMany.mockResolvedValue({ count: 1 });
  });

  it("メンバーをソフトデリート（DISABLED）できる", async () => {
    const { DELETE } = await import("@/app/api/recruiter/members/[id]/route");
    const response = await DELETE(createDeleteRequest(), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("DISABLED");
    expect(mockPrisma.recruiter.updateMany).toHaveBeenCalledWith({
      where: {
        id: TARGET_ID,
        companyId: COMPANY_ID,
        status: { not: "DISABLED" },
      },
      data: { status: "DISABLED" },
    });
  });

  it("同じcompanyIdのメンバーのみ対象にする", async () => {
    const { DELETE } = await import("@/app/api/recruiter/members/[id]/route");
    await DELETE(createDeleteRequest(), routeContext);

    expect(mockPrisma.recruiter.findFirst).toHaveBeenCalledWith({
      where: { id: TARGET_ID, companyId: COMPANY_ID },
      include: { account: true },
    });
  });

  it("未認証の場合401を返す", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/recruiter/members/[id]/route");
    const response = await DELETE(createDeleteRequest(), routeContext);

    expect(response.status).toBe(401);
  });

  it("権限がない場合403を返す", async () => {
    mockCanManageMembers.mockReturnValue(false);

    const { DELETE } = await import("@/app/api/recruiter/members/[id]/route");
    const response = await DELETE(createDeleteRequest(), routeContext);

    expect(response.status).toBe(403);
  });

  it("対象メンバーが見つからない場合404を返す", async () => {
    mockPrisma.recruiter.findFirst.mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/recruiter/members/[id]/route");
    const response = await DELETE(createDeleteRequest(), routeContext);

    expect(response.status).toBe(404);
    expect(mockPrisma.recruiter.updateMany).not.toHaveBeenCalled();
  });

  it("自分自身は削除できない", async () => {
    mockPrisma.recruiter.findFirst.mockResolvedValue({
      ...mockTarget,
      accountId: ACCOUNT_ID,
    });

    const { DELETE } = await import("@/app/api/recruiter/members/[id]/route");
    const response = await DELETE(createDeleteRequest(), routeContext);

    expect(response.status).toBe(409);
    expect(mockPrisma.recruiter.updateMany).not.toHaveBeenCalled();
  });

  it("同時リクエストで既にDISABLEDなら409を返す", async () => {
    mockPrisma.recruiter.updateMany.mockResolvedValue({ count: 0 });

    const { DELETE } = await import("@/app/api/recruiter/members/[id]/route");
    const response = await DELETE(createDeleteRequest(), routeContext);

    expect(response.status).toBe(409);
  });

  it("非OWNERがOWNERを削除できない", async () => {
    mockGetRecruiterWithCompany.mockResolvedValue({
      ...mockCompanyData,
      recruiter: { ...mockCompanyData.recruiter, role: "ADMIN" },
    });
    mockPrisma.recruiter.findFirst.mockResolvedValue({
      ...mockTarget,
      role: "OWNER",
    });

    const { DELETE } = await import("@/app/api/recruiter/members/[id]/route");
    const response = await DELETE(createDeleteRequest(), routeContext);

    expect(response.status).toBe(403);
    expect(mockPrisma.recruiter.updateMany).not.toHaveBeenCalled();
  });
});
