import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Rate limiter モック（テスト時はレート制限をスキップ）
vi.mock("@/lib/rate-limiter", () => ({
  RATE_LIMIT_PRESETS: {
    PUBLIC_AUTH: { points: 10, duration: 60 },
    REGISTER: { points: 5, duration: 300 },
    VERIFY_EMAIL: { points: 3, duration: 300 },
  },
  checkRateLimit: vi.fn(),
}));

// bcryptjs モック
const mockHash = vi.fn();
vi.mock("bcryptjs", () => ({
  hash: (...args: unknown[]) => mockHash(...args),
}));

// Logger モック
const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
vi.mock("@/lib/logger", () => ({ logger: mockLogger }));

// Prisma トランザクション用クライアント
const mockTxClient = {
  account: { create: vi.fn() },
  company: { create: vi.fn() },
  recruiter: { create: vi.fn() },
};

// Prisma メインクライアント
const mockPrisma = {
  account: { findUnique: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// Company モック
const mockGenerateUniqueSlug = vi.fn();
vi.mock("@/lib/company", () => ({
  generateUniqueSlug: (...args: unknown[]) => mockGenerateUniqueSlug(...args),
}));

// Verification モック
const mockCreateAndSendVerificationToken = vi.fn();
vi.mock("@/lib/verification", () => ({
  createAndSendVerificationToken: (...args: unknown[]) =>
    mockCreateAndSendVerificationToken(...args),
}));

// NextAuth モック
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validUserBody = {
  email: "test@example.com",
  password: "password123",
  name: "テスト太郎",
  accountType: "USER" as const,
};

const validRecruiterBody = {
  email: "recruiter@example.com",
  password: "password123",
  name: "採用太郎",
  accountType: "RECRUITER" as const,
  companyName: "テスト株式会社",
};

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHash.mockResolvedValue("hashed_password");
    mockPrisma.account.findUnique.mockResolvedValue(null);
    mockGenerateUniqueSlug.mockResolvedValue("test-company");
    mockCreateAndSendVerificationToken.mockResolvedValue(undefined);
    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mockTxClient) => Promise<unknown>) => {
        return callback(mockTxClient);
      },
    );
  });

  describe("バリデーション", () => {
    it("メールアドレスが無効な場合は400を返す", async () => {
      const { POST } = await import("@/app/api/auth/register/route");
      const req = createRequest({ ...validUserBody, email: "not-an-email" });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("パスワードが6文字未満の場合は400を返す", async () => {
      const { POST } = await import("@/app/api/auth/register/route");
      const req = createRequest({ ...validUserBody, password: "12345" });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("パスワードが100文字を超える場合は400を返す", async () => {
      const { POST } = await import("@/app/api/auth/register/route");
      const req = createRequest({
        ...validUserBody,
        password: "a".repeat(101),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("名前が空の場合は400を返す", async () => {
      const { POST } = await import("@/app/api/auth/register/route");
      const req = createRequest({ ...validUserBody, name: "" });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("無効なaccountTypeの場合は400を返す", async () => {
      const { POST } = await import("@/app/api/auth/register/route");
      const req = createRequest({
        ...validUserBody,
        accountType: "INVALID",
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("RECRUITER登録時にcompanyNameが空の場合は400を返す", async () => {
      const { POST } = await import("@/app/api/auth/register/route");
      const req = createRequest({
        ...validRecruiterBody,
        companyName: "",
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("RECRUITER登録時にcompanyNameがない場合は400を返す", async () => {
      const { POST } = await import("@/app/api/auth/register/route");
      const { companyName: _, ...body } = validRecruiterBody;
      const req = createRequest(body);

      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe("求職者（USER）登録", () => {
    it("正常に登録でき201を返す", async () => {
      const { POST } = await import("@/app/api/auth/register/route");
      mockPrisma.account.create.mockResolvedValue({
        id: "acc-1",
        email: "test@example.com",
        accountType: "USER",
        user: { id: "user-1", name: "テスト太郎" },
      });

      const req = createRequest(validUserBody);
      const res = await POST(req);

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.account.id).toBe("acc-1");
      expect(data.account.email).toBe("test@example.com");
      expect(data.account.accountType).toBe("USER");
      expect(data.requiresVerification).toBe(true);
    });

    it("パスワードをbcryptでハッシュ化する", async () => {
      const { POST } = await import("@/app/api/auth/register/route");
      mockPrisma.account.create.mockResolvedValue({
        id: "acc-1",
        email: "test@example.com",
        accountType: "USER",
      });

      const req = createRequest(validUserBody);
      await POST(req);

      expect(mockHash).toHaveBeenCalledWith("password123", 12);
      expect(mockPrisma.account.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ passwordHash: "hashed_password" }),
        }),
      );
    });

    it("アカウント作成後に認証メールを送信する", async () => {
      const { POST } = await import("@/app/api/auth/register/route");
      mockPrisma.account.create.mockResolvedValue({
        id: "acc-1",
        email: "test@example.com",
        accountType: "USER",
      });

      const req = createRequest(validUserBody);
      await POST(req);

      expect(mockCreateAndSendVerificationToken).toHaveBeenCalledWith(
        "acc-1",
        "test@example.com",
      );
    });

    it("認証メール送信が失敗してもアカウント登録は成功する", async () => {
      const { POST } = await import("@/app/api/auth/register/route");
      mockPrisma.account.create.mockResolvedValue({
        id: "acc-1",
        email: "test@example.com",
        accountType: "USER",
      });
      mockCreateAndSendVerificationToken.mockRejectedValue(
        new Error("SMTP connection failed"),
      );

      const req = createRequest(validUserBody);
      const res = await POST(req);

      expect(res.status).toBe(201);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to send verification email after registration",
        expect.any(Error),
        expect.objectContaining({ accountId: "acc-1" }),
      );
    });
  });

  describe("採用担当者（RECRUITER）登録", () => {
    it("正常に登録でき201を返す（会社+Recruiter同時作成）", async () => {
      const { POST } = await import("@/app/api/auth/register/route");
      mockTxClient.account.create.mockResolvedValue({
        id: "acc-2",
        email: "recruiter@example.com",
        accountType: "RECRUITER",
      });
      mockTxClient.company.create.mockResolvedValue({
        id: "comp-1",
        name: "テスト株式会社",
        slug: "test-company",
      });
      mockTxClient.recruiter.create.mockResolvedValue({
        id: "rec-1",
        role: "OWNER",
      });

      const req = createRequest(validRecruiterBody);
      const res = await POST(req);

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.account.accountType).toBe("RECRUITER");
      expect(data.company.name).toBe("テスト株式会社");
      expect(data.company.slug).toBe("test-company");
      expect(data.recruiter.role).toBe("OWNER");
      expect(data.requiresVerification).toBe(true);
    });

    it("トランザクション内でアカウント→会社→Recruiterの順に作成する", async () => {
      const { POST } = await import("@/app/api/auth/register/route");
      const callOrder: string[] = [];
      mockTxClient.account.create.mockImplementation(async () => {
        callOrder.push("account");
        return {
          id: "acc-2",
          email: "recruiter@example.com",
          accountType: "RECRUITER",
        };
      });
      mockTxClient.company.create.mockImplementation(async () => {
        callOrder.push("company");
        return { id: "comp-1", name: "テスト株式会社", slug: "test-company" };
      });
      mockTxClient.recruiter.create.mockImplementation(async () => {
        callOrder.push("recruiter");
        return { id: "rec-1", role: "OWNER" };
      });

      const req = createRequest(validRecruiterBody);
      await POST(req);

      expect(callOrder).toEqual(["account", "company", "recruiter"]);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it("会社スラッグを生成する", async () => {
      const { POST } = await import("@/app/api/auth/register/route");
      mockTxClient.account.create.mockResolvedValue({
        id: "acc-2",
        email: "recruiter@example.com",
        accountType: "RECRUITER",
      });
      mockTxClient.company.create.mockResolvedValue({
        id: "comp-1",
        name: "テスト株式会社",
        slug: "test-company",
      });
      mockTxClient.recruiter.create.mockResolvedValue({
        id: "rec-1",
        role: "OWNER",
      });

      const req = createRequest(validRecruiterBody);
      await POST(req);

      expect(mockGenerateUniqueSlug).toHaveBeenCalledWith("テスト株式会社");
    });

    it("認証メール送信が失敗しても登録は成功する", async () => {
      const { POST } = await import("@/app/api/auth/register/route");
      mockTxClient.account.create.mockResolvedValue({
        id: "acc-2",
        email: "recruiter@example.com",
        accountType: "RECRUITER",
      });
      mockTxClient.company.create.mockResolvedValue({
        id: "comp-1",
        name: "テスト株式会社",
        slug: "test-company",
      });
      mockTxClient.recruiter.create.mockResolvedValue({
        id: "rec-1",
        role: "OWNER",
      });
      mockCreateAndSendVerificationToken.mockRejectedValue(
        new Error("Email service down"),
      );

      const req = createRequest(validRecruiterBody);
      const res = await POST(req);

      expect(res.status).toBe(201);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to send verification email after registration",
        expect.any(Error),
        expect.objectContaining({ accountId: "acc-2" }),
      );
    });
  });

  describe("メールアドレス重複チェック", () => {
    it("既存アカウントがある場合は409を返す", async () => {
      const { POST } = await import("@/app/api/auth/register/route");
      mockPrisma.account.findUnique.mockResolvedValue({
        id: "existing-acc",
        email: "test@example.com",
      });

      const req = createRequest(validUserBody);
      const res = await POST(req);

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain("既に登録されています");
    });

    it("レースコンディション: DB unique制約違反時は409を返す（USER）", async () => {
      const { POST } = await import("@/app/api/auth/register/route");
      // findUniqueは通過するが、createでunique制約違反
      mockPrisma.account.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "6.0.0",
        }),
      );

      const req = createRequest(validUserBody);
      const res = await POST(req);

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain("既に登録されています");
    });

    it("レースコンディション: DB unique制約違反時は409を返す（RECRUITER）", async () => {
      const { POST } = await import("@/app/api/auth/register/route");
      // トランザクション内でunique制約違反
      mockPrisma.$transaction.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "6.0.0",
        }),
      );

      mockTxClient.account.create.mockResolvedValue({
        id: "acc-2",
        email: "recruiter@example.com",
        accountType: "RECRUITER",
      });

      const req = createRequest(validRecruiterBody);
      const res = await POST(req);

      expect(res.status).toBe(409);
    });

    it("P2002以外のPrismaエラーは再スローされる", async () => {
      const { POST } = await import("@/app/api/auth/register/route");
      mockPrisma.account.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Connection error", {
          code: "P1001",
          clientVersion: "6.0.0",
        }),
      );

      const req = createRequest(validUserBody);
      const res = await POST(req);

      // withErrorHandlingが500を返す
      expect(res.status).toBe(500);
    });
  });
});
