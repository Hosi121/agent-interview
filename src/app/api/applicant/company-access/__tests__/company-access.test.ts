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
  companyAccess: {
    findMany: vi.fn(),
    upsert: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  company: {
    findUnique: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ── Constants ──────────────────────────────────────────────────────

const USER_ID = "user-001";
const ACCOUNT_ID = "acc-1";
const COMPANY_ID = "company-001";
const ACCESS_ID = "access-001";

const userSession = {
  user: {
    accountId: ACCOUNT_ID,
    userId: USER_ID,
    accountType: "USER",
  },
};

const mockCompany = {
  id: COMPANY_ID,
  name: "テスト株式会社",
};

const mockAccessRecord = {
  id: ACCESS_ID,
  userId: USER_ID,
  companyId: COMPANY_ID,
  status: "ALLOW",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  company: { id: COMPANY_ID, name: "テスト株式会社" },
};

// ── Helpers ────────────────────────────────────────────────────────

function createGetRequest(): NextRequest {
  return new NextRequest("http://localhost/api/applicant/company-access", {
    method: "GET",
  });
}

function createPatchRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/applicant/company-access", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createDeleteRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/applicant/company-access", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── GET Tests ──────────────────────────────────────────────────────

describe("GET /api/applicant/company-access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(userSession);
  });

  it("アクセス設定一覧を返す", async () => {
    mockPrisma.companyAccess.findMany.mockResolvedValue([mockAccessRecord]);

    const { GET } = await import("@/app/api/applicant/company-access/route");
    const response = await GET(createGetRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.accessList).toHaveLength(1);
    expect(data.accessList[0].companyId).toBe(COMPANY_ID);
    expect(data.accessList[0].companyName).toBe("テスト株式会社");
    expect(data.accessList[0].status).toBe("ALLOW");
  });

  it("自分のuserIdでフィルタする", async () => {
    mockPrisma.companyAccess.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/applicant/company-access/route");
    await GET(createGetRequest());

    expect(mockPrisma.companyAccess.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID },
      }),
    );
  });

  it("空の一覧を返せる", async () => {
    mockPrisma.companyAccess.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/applicant/company-access/route");
    const response = await GET(createGetRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.accessList).toHaveLength(0);
  });

  it("未認証の場合401を返す", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { GET } = await import("@/app/api/applicant/company-access/route");
    const response = await GET(createGetRequest());

    expect(response.status).toBe(401);
  });
});

// ── PATCH Tests ────────────────────────────────────────────────────

describe("PATCH /api/applicant/company-access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(userSession);
    mockPrisma.company.findUnique.mockResolvedValue(mockCompany);
    mockPrisma.companyAccess.upsert.mockResolvedValue(mockAccessRecord);
  });

  it("ALLOWステータスでアクセス設定を作成/更新できる", async () => {
    const { PATCH } = await import("@/app/api/applicant/company-access/route");
    const response = await PATCH(
      createPatchRequest({ companyId: COMPANY_ID, status: "ALLOW" }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.companyId).toBe(COMPANY_ID);
    expect(data.status).toBe("ALLOW");
  });

  it("DENYステータスでアクセス設定を作成/更新できる", async () => {
    mockPrisma.companyAccess.upsert.mockResolvedValue({
      ...mockAccessRecord,
      status: "DENY",
    });

    const { PATCH } = await import("@/app/api/applicant/company-access/route");
    const response = await PATCH(
      createPatchRequest({ companyId: COMPANY_ID, status: "DENY" }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("DENY");
  });

  it("upsertで自分のuserIdを使用する", async () => {
    const { PATCH } = await import("@/app/api/applicant/company-access/route");
    await PATCH(createPatchRequest({ companyId: COMPANY_ID, status: "ALLOW" }));

    expect(mockPrisma.companyAccess.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_companyId: {
            userId: USER_ID,
            companyId: COMPANY_ID,
          },
        },
        create: expect.objectContaining({
          userId: USER_ID,
          companyId: COMPANY_ID,
          status: "ALLOW",
        }),
        update: { status: "ALLOW" },
      }),
    );
  });

  it("企業が存在しない場合404を返す", async () => {
    mockPrisma.company.findUnique.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/applicant/company-access/route");
    const response = await PATCH(
      createPatchRequest({ companyId: "non-existent", status: "ALLOW" }),
    );

    expect(response.status).toBe(404);
  });

  it("companyIdなしで400を返す", async () => {
    const { PATCH } = await import("@/app/api/applicant/company-access/route");
    const response = await PATCH(createPatchRequest({ status: "ALLOW" }));

    expect(response.status).toBe(400);
  });

  it("無効なステータスで400を返す", async () => {
    const { PATCH } = await import("@/app/api/applicant/company-access/route");
    const response = await PATCH(
      createPatchRequest({ companyId: COMPANY_ID, status: "INVALID" }),
    );

    expect(response.status).toBe(400);
  });

  it("未認証の場合401を返す", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/applicant/company-access/route");
    const response = await PATCH(
      createPatchRequest({ companyId: COMPANY_ID, status: "ALLOW" }),
    );

    expect(response.status).toBe(401);
  });
});

// ── DELETE Tests ────────────────────────────────────────────────────

describe("DELETE /api/applicant/company-access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(userSession);
    mockPrisma.companyAccess.findUnique.mockResolvedValue(mockAccessRecord);
    mockPrisma.companyAccess.delete.mockResolvedValue(mockAccessRecord);
  });

  it("アクセス設定を削除できる", async () => {
    const { DELETE } = await import("@/app/api/applicant/company-access/route");
    const response = await DELETE(
      createDeleteRequest({ companyId: COMPANY_ID }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.deleted).toBe(true);
  });

  it("自分のuserIdで削除する", async () => {
    const { DELETE } = await import("@/app/api/applicant/company-access/route");
    await DELETE(createDeleteRequest({ companyId: COMPANY_ID }));

    expect(mockPrisma.companyAccess.delete).toHaveBeenCalledWith({
      where: {
        userId_companyId: {
          userId: USER_ID,
          companyId: COMPANY_ID,
        },
      },
    });
  });

  it("存在しない設定の削除は404を返す", async () => {
    mockPrisma.companyAccess.findUnique.mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/applicant/company-access/route");
    const response = await DELETE(
      createDeleteRequest({ companyId: COMPANY_ID }),
    );

    expect(response.status).toBe(404);
    expect(mockPrisma.companyAccess.delete).not.toHaveBeenCalled();
  });

  it("companyIdなしで400を返す", async () => {
    const { DELETE } = await import("@/app/api/applicant/company-access/route");
    const response = await DELETE(createDeleteRequest({}));

    expect(response.status).toBe(400);
  });

  it("未認証の場合401を返す", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/applicant/company-access/route");
    const response = await DELETE(
      createDeleteRequest({ companyId: COMPANY_ID }),
    );

    expect(response.status).toBe(401);
  });
});
