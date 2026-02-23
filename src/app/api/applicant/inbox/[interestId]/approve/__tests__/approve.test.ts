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

// Points モック
const mockConsumePointsWithOperations = vi.fn();
vi.mock("@/lib/points", () => ({
  consumePointsWithOperations: (...args: unknown[]) =>
    mockConsumePointsWithOperations(...args),
}));

// Prisma モック
const mockPrisma = {
  interest: { findUnique: vi.fn() },
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
  user: {
    id: USER_ID,
    name: "テスト太郎",
    email: "test@example.com",
    phone: "090-1234-5678",
    accountId: "acc-user",
  },
  recruiter: {
    id: RECRUITER_ID,
    companyId: COMPANY_ID,
    accountId: "acc-recruiter",
    company: { name: "テスト株式会社" },
  },
};

function createRequest(body?: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/applicant/inbox/${INTEREST_ID}/approve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    },
  );
}

describe("POST /api/applicant/inbox/[interestId]/approve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(userSession);
    mockPrisma.interest.findUnique.mockResolvedValue(mockInterest);
    mockConsumePointsWithOperations.mockImplementation(
      async (
        _companyId: string,
        _action: string,
        operations: (tx: unknown) => Promise<unknown>,
      ) => {
        const mockTx = {
          interest: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          companyAccess: { upsert: vi.fn().mockResolvedValue({}) },
          notification: { create: vi.fn().mockResolvedValue({}) },
        };
        const result = await operations(mockTx);
        return { newBalance: 50, consumed: 10, result };
      },
    );
  });

  describe("認証", () => {
    it("未認証の場合は401を返す", async () => {
      mockGetServerSession.mockResolvedValue(null);
      const { POST } = await import(
        "@/app/api/applicant/inbox/[interestId]/approve/route"
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
        "@/app/api/applicant/inbox/[interestId]/approve/route"
      );

      const res = await POST(createRequest(), routeContext);
      expect(res.status).toBe(403);
    });
  });

  describe("状態チェック", () => {
    it("存在しない興味表明は404を返す", async () => {
      mockPrisma.interest.findUnique.mockResolvedValue(null);
      const { POST } = await import(
        "@/app/api/applicant/inbox/[interestId]/approve/route"
      );

      const res = await POST(createRequest(), routeContext);
      expect(res.status).toBe(404);
    });

    it("既に開示済みの場合は連絡先を返す（冪等）", async () => {
      mockPrisma.interest.findUnique.mockResolvedValue({
        ...mockInterest,
        status: "CONTACT_DISCLOSED",
      });
      const { POST } = await import(
        "@/app/api/applicant/inbox/[interestId]/approve/route"
      );

      const res = await POST(createRequest(), routeContext);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("CONTACT_DISCLOSED");
      expect(data.contact.email).toBe("test@example.com");
      // consumePointsは呼ばれない
      expect(mockConsumePointsWithOperations).not.toHaveBeenCalled();
    });

    it("辞退済みの場合は409を返す", async () => {
      mockPrisma.interest.findUnique.mockResolvedValue({
        ...mockInterest,
        status: "DECLINED",
      });
      const { POST } = await import(
        "@/app/api/applicant/inbox/[interestId]/approve/route"
      );

      const res = await POST(createRequest(), routeContext);
      expect(res.status).toBe(409);
    });

    it("CONTACT_REQUESTEDでない場合は400を返す", async () => {
      mockPrisma.interest.findUnique.mockResolvedValue({
        ...mockInterest,
        status: "INTERESTED",
      });
      const { POST } = await import(
        "@/app/api/applicant/inbox/[interestId]/approve/route"
      );

      const res = await POST(createRequest(), routeContext);
      expect(res.status).toBe(400);
    });
  });

  describe("正常系", () => {
    it("承認成功で連絡先を返す", async () => {
      const { POST } = await import(
        "@/app/api/applicant/inbox/[interestId]/approve/route"
      );

      const res = await POST(createRequest(), routeContext);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("CONTACT_DISCLOSED");
      expect(data.contact.name).toBe("テスト太郎");
      expect(data.contact.email).toBe("test@example.com");
    });

    it("consumePointsWithOperationsに正しいパラメータを渡す", async () => {
      const { POST } = await import(
        "@/app/api/applicant/inbox/[interestId]/approve/route"
      );

      await POST(createRequest(), routeContext);

      expect(mockConsumePointsWithOperations).toHaveBeenCalledWith(
        COMPANY_ID,
        "CONTACT_DISCLOSURE",
        expect.any(Function),
        INTEREST_ID,
        "連絡先開示: テスト太郎",
      );
    });

    it("bodyなしでもデフォルトpreference=NONEで動作する", async () => {
      const { POST } = await import(
        "@/app/api/applicant/inbox/[interestId]/approve/route"
      );

      const req = new NextRequest(
        `http://localhost/api/applicant/inbox/${INTEREST_ID}/approve`,
        { method: "POST" },
      );
      const res = await POST(req, routeContext);
      expect(res.status).toBe(200);
    });
  });

  describe("TOCTOU防止（二重消費防止）", () => {
    it("トランザクション内で状態をチェックし、既に処理済みなら409を返す", async () => {
      mockConsumePointsWithOperations.mockImplementation(
        async (
          _companyId: string,
          _action: string,
          operations: (tx: unknown) => Promise<unknown>,
        ) => {
          const mockTx = {
            interest: {
              // updateManyが0件 = 既に別リクエストで処理済み
              updateMany: vi.fn().mockResolvedValue({ count: 0 }),
            },
            companyAccess: { upsert: vi.fn() },
            notification: { create: vi.fn() },
          };
          return operations(mockTx);
        },
      );
      const { POST } = await import(
        "@/app/api/applicant/inbox/[interestId]/approve/route"
      );

      const res = await POST(createRequest(), routeContext);
      expect(res.status).toBe(409);
    });

    it("トランザクション内でupdateManyを使いstatusフィルター付きで更新する", async () => {
      let capturedTx: {
        interest: { updateMany: ReturnType<typeof vi.fn> };
        companyAccess: { upsert: ReturnType<typeof vi.fn> };
        notification: { create: ReturnType<typeof vi.fn> };
      } | null = null;

      mockConsumePointsWithOperations.mockImplementation(
        async (
          _companyId: string,
          _action: string,
          operations: (tx: unknown) => Promise<unknown>,
        ) => {
          const mockTx = {
            interest: {
              updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
            companyAccess: { upsert: vi.fn().mockResolvedValue({}) },
            notification: { create: vi.fn().mockResolvedValue({}) },
          };
          capturedTx = mockTx;
          const result = await operations(mockTx);
          return { newBalance: 50, consumed: 10, result };
        },
      );
      const { POST } = await import(
        "@/app/api/applicant/inbox/[interestId]/approve/route"
      );

      await POST(createRequest(), routeContext);

      expect(capturedTx).not.toBeNull();
      expect(capturedTx!.interest.updateMany).toHaveBeenCalledWith({
        where: { id: INTEREST_ID, status: "CONTACT_REQUESTED" },
        data: { status: "CONTACT_DISCLOSED" },
      });
    });
  });

  describe("preference=ALLOW", () => {
    it("ALLOWの場合はcompanyAccessをupsertする", async () => {
      let capturedTx: {
        interest: { updateMany: ReturnType<typeof vi.fn> };
        companyAccess: { upsert: ReturnType<typeof vi.fn> };
        notification: { create: ReturnType<typeof vi.fn> };
      } | null = null;

      mockConsumePointsWithOperations.mockImplementation(
        async (
          _companyId: string,
          _action: string,
          operations: (tx: unknown) => Promise<unknown>,
        ) => {
          const mockTx = {
            interest: {
              updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
            companyAccess: { upsert: vi.fn().mockResolvedValue({}) },
            notification: { create: vi.fn().mockResolvedValue({}) },
          };
          capturedTx = mockTx;
          const result = await operations(mockTx);
          return { newBalance: 50, consumed: 10, result };
        },
      );
      const { POST } = await import(
        "@/app/api/applicant/inbox/[interestId]/approve/route"
      );

      await POST(createRequest({ preference: "ALLOW" }), routeContext);

      expect(capturedTx!.companyAccess.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_companyId: { userId: USER_ID, companyId: COMPANY_ID },
          },
          create: expect.objectContaining({ status: "ALLOW" }),
        }),
      );
    });
  });
});
