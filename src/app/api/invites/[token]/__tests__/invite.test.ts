import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// bcryptjs モック
const mockHash = vi.fn();
vi.mock("bcryptjs", () => ({
  hash: (...args: unknown[]) => mockHash(...args),
}));

// Logger モック
const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
vi.mock("@/lib/logger", () => ({ logger: mockLogger }));

// NextAuth モック（withErrorHandling用）
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

// Prisma トランザクション用クライアント
const mockTxClient = {
  account: { create: vi.fn() },
  invite: { updateMany: vi.fn() },
};

// Prisma メインクライアント
const mockPrisma = {
  invite: { findUnique: vi.fn(), update: vi.fn() },
  account: { findUnique: vi.fn() },
  $transaction: vi.fn(),
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const INVITE_TOKEN = "valid-invite-token-abc123";
const COMPANY_ID = "company-001";
const ACCOUNT_ID = "new-account-001";

const mockCompany = {
  id: COMPANY_ID,
  name: "テスト株式会社",
  slug: "test-company",
};

const validInvite = {
  id: "invite-001",
  token: INVITE_TOKEN,
  email: "newuser@example.com",
  role: "MEMBER",
  status: "PENDING",
  companyId: COMPANY_ID,
  company: mockCompany,
  invitedByAccountId: "inviter-001",
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7日後
  createdAt: new Date(),
};

function createGetRequest(): NextRequest {
  return new NextRequest(`http://localhost/api/invites/${INVITE_TOKEN}`, {
    method: "GET",
  });
}

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/invites/${INVITE_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const routeContext = { params: Promise.resolve({ token: INVITE_TOKEN }) };

describe("GET /api/invites/[token]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.invite.findUnique.mockResolvedValue(validInvite);
  });

  it("有効な招待の情報を返す", async () => {
    const { GET } = await import("@/app/api/invites/[token]/route");

    const res = await GET(createGetRequest(), routeContext);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.email).toBe("newuser@example.com");
    expect(data.companyName).toBe("テスト株式会社");
    expect(data.role).toBe("MEMBER");
  });

  it("存在しない招待は404を返す", async () => {
    mockPrisma.invite.findUnique.mockResolvedValue(null);
    const { GET } = await import("@/app/api/invites/[token]/route");

    const res = await GET(createGetRequest(), routeContext);
    expect(res.status).toBe(404);
  });

  it("使用済みの招待は410を返す", async () => {
    mockPrisma.invite.findUnique.mockResolvedValue({
      ...validInvite,
      status: "USED",
    });
    const { GET } = await import("@/app/api/invites/[token]/route");

    const res = await GET(createGetRequest(), routeContext);
    expect(res.status).toBe(410);
  });

  it("期限切れの招待は410を返しステータスを更新する", async () => {
    mockPrisma.invite.findUnique.mockResolvedValue({
      ...validInvite,
      expiresAt: new Date(Date.now() - 1000), // 過去
    });
    mockPrisma.invite.update.mockResolvedValue({});
    const { GET } = await import("@/app/api/invites/[token]/route");

    const res = await GET(createGetRequest(), routeContext);
    expect(res.status).toBe(410);
    expect(mockPrisma.invite.update).toHaveBeenCalledWith({
      where: { id: "invite-001" },
      data: { status: "EXPIRED" },
    });
  });
});

describe("POST /api/invites/[token]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.invite.findUnique.mockResolvedValue(validInvite);
    mockHash.mockResolvedValue("hashed-password");
    mockTxClient.account.create.mockResolvedValue({ id: ACCOUNT_ID });
    mockTxClient.invite.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mockTxClient) => Promise<unknown>) => {
        return callback(mockTxClient);
      },
    );
  });

  describe("バリデーション", () => {
    it("パスワードなしの場合は400を返す", async () => {
      const { POST } = await import("@/app/api/invites/[token]/route");

      const res = await POST(createPostRequest({}), routeContext);
      expect(res.status).toBe(400);
    });

    it("パスワードが短すぎる場合は400を返す", async () => {
      const { POST } = await import("@/app/api/invites/[token]/route");

      const res = await POST(
        createPostRequest({ password: "abc" }),
        routeContext,
      );
      expect(res.status).toBe(400);
    });
  });

  describe("招待の検証", () => {
    it("存在しない招待は404を返す", async () => {
      mockPrisma.invite.findUnique.mockResolvedValue(null);
      const { POST } = await import("@/app/api/invites/[token]/route");

      const res = await POST(
        createPostRequest({ password: "securePassword123" }),
        routeContext,
      );
      expect(res.status).toBe(404);
    });

    it("使用済みの招待は400を返す", async () => {
      mockPrisma.invite.findUnique.mockResolvedValue({
        ...validInvite,
        status: "USED",
      });
      const { POST } = await import("@/app/api/invites/[token]/route");

      const res = await POST(
        createPostRequest({ password: "securePassword123" }),
        routeContext,
      );
      expect(res.status).toBe(400);
    });

    it("期限切れの招待は400を返しステータスをEXPIREDに更新する", async () => {
      mockPrisma.invite.findUnique.mockResolvedValue({
        ...validInvite,
        expiresAt: new Date(Date.now() - 1000),
      });
      mockPrisma.invite.update.mockResolvedValue({});
      const { POST } = await import("@/app/api/invites/[token]/route");

      const res = await POST(
        createPostRequest({ password: "securePassword123" }),
        routeContext,
      );
      expect(res.status).toBe(400);
      expect(mockPrisma.invite.update).toHaveBeenCalledWith({
        where: { id: "invite-001" },
        data: { status: "EXPIRED" },
      });
    });
  });

  describe("正常系", () => {
    it("アカウントを作成し201を返す", async () => {
      const { POST } = await import("@/app/api/invites/[token]/route");

      const res = await POST(
        createPostRequest({ password: "securePassword123" }),
        routeContext,
      );
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.accountId).toBe(ACCOUNT_ID);
    });

    it("トランザクション内でアカウント作成と招待更新を行う", async () => {
      const { POST } = await import("@/app/api/invites/[token]/route");

      await POST(
        createPostRequest({ password: "securePassword123" }),
        routeContext,
      );

      expect(mockTxClient.account.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: "newuser@example.com",
          passwordHash: "hashed-password",
          accountType: "RECRUITER",
          emailVerified: true,
          recruiter: {
            create: expect.objectContaining({
              companyId: COMPANY_ID,
              role: "MEMBER",
              status: "ACTIVE",
              invitedByAccountId: "inviter-001",
            }),
          },
        }),
      });

      expect(mockTxClient.invite.updateMany).toHaveBeenCalledWith({
        where: { id: "invite-001", status: "PENDING" },
        data: expect.objectContaining({
          status: "USED",
          usedAccountId: ACCOUNT_ID,
        }),
      });
    });

    it("パスワードをbcryptでハッシュ化する", async () => {
      const { POST } = await import("@/app/api/invites/[token]/route");

      await POST(
        createPostRequest({ password: "securePassword123" }),
        routeContext,
      );

      expect(mockHash).toHaveBeenCalledWith("securePassword123", 12);
    });
  });

  describe("招待ステータス競合（TOCTOU対策）", () => {
    it("同時リクエストで招待が既に使用済みなら409を返す", async () => {
      mockTxClient.invite.updateMany.mockResolvedValue({ count: 0 });
      const { POST } = await import("@/app/api/invites/[token]/route");

      const res = await POST(
        createPostRequest({ password: "securePassword123" }),
        routeContext,
      );
      expect(res.status).toBe(409);
    });
  });

  describe("メールアドレス競合（TOCTOU対策）", () => {
    it("P2002ユニーク制約違反時は409を返す", async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed",
        { code: "P2002", clientVersion: "6.0.0", meta: { target: ["email"] } },
      );
      mockPrisma.$transaction.mockRejectedValue(p2002Error);
      const { POST } = await import("@/app/api/invites/[token]/route");

      const res = await POST(
        createPostRequest({ password: "securePassword123" }),
        routeContext,
      );
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain("既に使用されています");
    });

    it("P2002エラー時にログ出力する", async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed",
        { code: "P2002", clientVersion: "6.0.0", meta: { target: ["email"] } },
      );
      mockPrisma.$transaction.mockRejectedValue(p2002Error);
      const { POST } = await import("@/app/api/invites/[token]/route");

      await POST(
        createPostRequest({ password: "securePassword123" }),
        routeContext,
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Invite acceptance email conflict",
        expect.objectContaining({
          email: "newuser@example.com",
          inviteId: "invite-001",
        }),
      );
    });

    it("P2002以外のPrismaエラーはそのまま再スローされる", async () => {
      const otherError = new Prisma.PrismaClientKnownRequestError(
        "Foreign key constraint failed",
        { code: "P2003", clientVersion: "6.0.0", meta: {} },
      );
      mockPrisma.$transaction.mockRejectedValue(otherError);
      const { POST } = await import("@/app/api/invites/[token]/route");

      const res = await POST(
        createPostRequest({ password: "securePassword123" }),
        routeContext,
      );
      // withErrorHandling が500を返す
      expect(res.status).toBe(500);
    });
  });
});
