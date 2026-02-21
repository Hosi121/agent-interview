import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// NextAuth モック
const mockGetServerSession = vi.fn();
vi.mock("next-auth", () => ({
  getServerSession: () => mockGetServerSession(),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

// Logger モック
const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
vi.mock("@/lib/logger", () => ({ logger: mockLogger }));

// Prisma トランザクション用クライアント
const mockTxClient = {
  interest: { updateMany: vi.fn() },
  companyAccess: { upsert: vi.fn() },
  notification: { create: vi.fn() },
};

// Prisma メインクライアント
const mockPrisma = {
  interest: { findUnique: vi.fn() },
  $transaction: vi.fn(),
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const INTEREST_ID = "interest-001";
const USER_ID = "user-001";
const RECRUITER_ID = "recruiter-001";
const COMPANY_ID = "company-001";

const userSession = {
  user: {
    accountId: "acc-1",
    userId: USER_ID,
    accountType: "USER",
  },
};

const routeContext = {
  params: Promise.resolve({ interestId: INTEREST_ID }),
};

const mockInterest = {
  id: INTEREST_ID,
  userId: USER_ID,
  recruiterId: RECRUITER_ID,
  status: "CONTACT_REQUESTED",
  user: { id: USER_ID, name: "テスト太郎" },
  recruiter: {
    id: RECRUITER_ID,
    companyId: COMPANY_ID,
    accountId: "acc-recruiter",
    company: { name: "テスト株式会社" },
  },
};

function createRequest(body?: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/applicant/inbox/${INTEREST_ID}/decline`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    },
  );
}

describe("POST /api/applicant/inbox/[interestId]/decline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(userSession);
    mockPrisma.interest.findUnique.mockResolvedValue(mockInterest);
    mockTxClient.interest.updateMany.mockResolvedValue({ count: 1 });
    mockTxClient.companyAccess.upsert.mockResolvedValue({});
    mockTxClient.notification.create.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mockTxClient) => Promise<unknown>) => {
        return callback(mockTxClient);
      },
    );
  });

  describe("認証", () => {
    it("未認証の場合は401を返す", async () => {
      mockGetServerSession.mockResolvedValue(null);
      const { POST } = await import(
        "@/app/api/applicant/inbox/[interestId]/decline/route"
      );

      const res = await POST(createRequest(), routeContext);
      expect(res.status).toBe(401);
    });

    it("他人の興味表明は403を返す", async () => {
      mockPrisma.interest.findUnique.mockResolvedValue({
        ...mockInterest,
        userId: "other-user",
      });
      const { POST } = await import(
        "@/app/api/applicant/inbox/[interestId]/decline/route"
      );

      const res = await POST(createRequest(), routeContext);
      expect(res.status).toBe(403);
    });
  });

  describe("状態チェック", () => {
    it("存在しない興味表明は404を返す", async () => {
      mockPrisma.interest.findUnique.mockResolvedValue(null);
      const { POST } = await import(
        "@/app/api/applicant/inbox/[interestId]/decline/route"
      );

      const res = await POST(createRequest(), routeContext);
      expect(res.status).toBe(404);
    });

    it("既に開示済みの場合は409を返す", async () => {
      mockPrisma.interest.findUnique.mockResolvedValue({
        ...mockInterest,
        status: "CONTACT_DISCLOSED",
      });
      const { POST } = await import(
        "@/app/api/applicant/inbox/[interestId]/decline/route"
      );

      const res = await POST(createRequest(), routeContext);
      expect(res.status).toBe(409);
    });

    it("既に辞退済みの場合は冪等にDECLINEDを返す", async () => {
      mockPrisma.interest.findUnique.mockResolvedValue({
        ...mockInterest,
        status: "DECLINED",
      });
      const { POST } = await import(
        "@/app/api/applicant/inbox/[interestId]/decline/route"
      );

      const res = await POST(createRequest(), routeContext);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("DECLINED");
      // トランザクションは呼ばれない
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("正常系", () => {
    it("辞退成功でDECLINEDステータスを返す", async () => {
      const { POST } = await import(
        "@/app/api/applicant/inbox/[interestId]/decline/route"
      );

      const res = await POST(createRequest(), routeContext);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("DECLINED");
    });

    it("bodyなしでもデフォルトpreference=NONEで動作する", async () => {
      const { POST } = await import(
        "@/app/api/applicant/inbox/[interestId]/decline/route"
      );

      const req = new NextRequest(
        `http://localhost/api/applicant/inbox/${INTEREST_ID}/decline`,
        { method: "POST" },
      );
      const res = await POST(req, routeContext);
      expect(res.status).toBe(200);
      // companyAccessのupsertは呼ばれない
      expect(mockTxClient.companyAccess.upsert).not.toHaveBeenCalled();
    });

    it("通知が作成される", async () => {
      const { POST } = await import(
        "@/app/api/applicant/inbox/[interestId]/decline/route"
      );

      await POST(createRequest(), routeContext);

      expect(mockTxClient.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accountId: "acc-recruiter",
          type: "SYSTEM",
          title: "連絡先開示が辞退されました",
        }),
      });
    });
  });

  describe("TOCTOU防止", () => {
    it("トランザクション内でupdateManyを使い原子的に状態更新する", async () => {
      const { POST } = await import(
        "@/app/api/applicant/inbox/[interestId]/decline/route"
      );

      await POST(createRequest(), routeContext);

      expect(mockTxClient.interest.updateMany).toHaveBeenCalledWith({
        where: {
          id: INTEREST_ID,
          status: { notIn: ["DECLINED", "CONTACT_DISCLOSED"] },
        },
        data: { status: "DECLINED" },
      });
    });

    it("updateManyが0件の場合（同時処理済み）は409を返す", async () => {
      mockTxClient.interest.updateMany.mockResolvedValue({ count: 0 });
      const { POST } = await import(
        "@/app/api/applicant/inbox/[interestId]/decline/route"
      );

      const res = await POST(createRequest(), routeContext);
      expect(res.status).toBe(409);
    });
  });

  describe("preference=DENY", () => {
    it("DENYの場合はcompanyAccessにDENYをupsertする", async () => {
      const { POST } = await import(
        "@/app/api/applicant/inbox/[interestId]/decline/route"
      );

      await POST(createRequest({ preference: "DENY" }), routeContext);

      expect(mockTxClient.companyAccess.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_companyId: { userId: USER_ID, companyId: COMPANY_ID },
          },
          create: expect.objectContaining({ status: "DENY" }),
          update: { status: "DENY" },
        }),
      );
    });

    it("NONEの場合はcompanyAccessをupsertしない", async () => {
      const { POST } = await import(
        "@/app/api/applicant/inbox/[interestId]/decline/route"
      );

      await POST(createRequest({ preference: "NONE" }), routeContext);

      expect(mockTxClient.companyAccess.upsert).not.toHaveBeenCalled();
    });
  });
});
