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
  interest: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  companyAccess: {
    findUnique: vi.fn(),
  },
  notification: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockCheckPointBalance = vi.fn();
const mockConsumePointsWithOperations = vi.fn();
vi.mock("@/lib/points", () => ({
  checkPointBalance: (...args: unknown[]) => mockCheckPointBalance(...args),
  consumePointsWithOperations: (...args: unknown[]) =>
    mockConsumePointsWithOperations(...args),
}));

// ── Constants ──────────────────────────────────────────────────────

const RECRUITER_ID = "recruiter-001";
const COMPANY_ID = "company-001";
const INTEREST_ID = "interest-001";
const USER_ID = "user-001";

const recruiterSession = {
  user: {
    accountId: "acc-1",
    recruiterId: RECRUITER_ID,
    companyId: COMPANY_ID,
    accountType: "RECRUITER",
    recruiterStatus: "ACTIVE",
  },
};

const otherRecruiterSession = {
  user: {
    accountId: "acc-2",
    recruiterId: "recruiter-999",
    companyId: "company-999",
    accountType: "RECRUITER",
    recruiterStatus: "ACTIVE",
  },
};

const mockInterest = {
  id: INTEREST_ID,
  recruiterId: RECRUITER_ID,
  userId: USER_ID,
  status: "EXPRESSED",
  user: {
    id: USER_ID,
    name: "テスト太郎",
    email: "test@example.com",
    phone: "090-1234-5678",
    accountId: "user-acc-1",
  },
  recruiter: {
    id: RECRUITER_ID,
    companyId: COMPANY_ID,
    accountId: "acc-1",
    company: { name: "テスト企業" },
  },
};

const routeContext = {
  params: Promise.resolve({ id: INTEREST_ID }),
};

function createPostRequest(): NextRequest {
  return new NextRequest(
    `http://localhost/api/interests/${INTEREST_ID}/request`,
    { method: "POST" },
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let capturedTx: any;

// ── Tests ──────────────────────────────────────────────────────────

describe("POST /api/interests/[id]/request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(recruiterSession);
    capturedTx = null;

    // デフォルト: トランザクションはコールバック実行
    mockPrisma.$transaction.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (callback: (tx: any) => Promise<unknown>) => {
        capturedTx = {
          interest: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
          notification: { create: vi.fn().mockResolvedValue({}) },
        };
        return callback(capturedTx);
      },
    );
  });

  describe("認証・認可", () => {
    it("未認証の場合401を返す", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const { POST } = await import("@/app/api/interests/[id]/request/route");
      const response = await POST(createPostRequest(), routeContext);

      expect(response.status).toBe(401);
    });

    it("companyIdがない場合403を返す", async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          accountId: "acc-1",
          recruiterId: RECRUITER_ID,
          accountType: "RECRUITER",
          recruiterStatus: "ACTIVE",
        },
      });

      const { POST } = await import("@/app/api/interests/[id]/request/route");
      const response = await POST(createPostRequest(), routeContext);

      expect(response.status).toBe(403);
    });

    it("存在しない興味表明は404を返す", async () => {
      mockPrisma.interest.findUnique.mockResolvedValue(null);

      const { POST } = await import("@/app/api/interests/[id]/request/route");
      const response = await POST(createPostRequest(), routeContext);

      expect(response.status).toBe(404);
    });

    it("他リクルーターの興味表明は403を返す", async () => {
      mockGetServerSession.mockResolvedValue(otherRecruiterSession);
      mockPrisma.interest.findUnique.mockResolvedValue(mockInterest);

      const { POST } = await import("@/app/api/interests/[id]/request/route");
      const response = await POST(createPostRequest(), routeContext);

      expect(response.status).toBe(403);
    });
  });

  describe("既存ステータス処理", () => {
    it("CONTACT_DISCLOSED済みなら連絡先を返す", async () => {
      mockPrisma.interest.findUnique.mockResolvedValue({
        ...mockInterest,
        status: "CONTACT_DISCLOSED",
      });

      const { POST } = await import("@/app/api/interests/[id]/request/route");
      const response = await POST(createPostRequest(), routeContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.contact.email).toBe("test@example.com");
      expect(data.contact.phone).toBe("090-1234-5678");
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("DECLINED済みなら409を返す", async () => {
      mockPrisma.interest.findUnique.mockResolvedValue({
        ...mockInterest,
        status: "DECLINED",
      });

      const { POST } = await import("@/app/api/interests/[id]/request/route");
      const response = await POST(createPostRequest(), routeContext);

      expect(response.status).toBe(409);
    });
  });

  describe("DENY（自動辞退）", () => {
    beforeEach(() => {
      mockPrisma.interest.findUnique.mockResolvedValue(mockInterest);
      mockPrisma.companyAccess.findUnique.mockResolvedValue({
        status: "DENY",
      });
    });

    it("DENY設定で自動辞退される", async () => {
      const { POST } = await import("@/app/api/interests/[id]/request/route");
      const response = await POST(createPostRequest(), routeContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe("DECLINED");
      expect(data.auto).toBe(true);
    });

    it("条件付きupdateManyで辞退する（TOCTOU防止）", async () => {
      const { POST } = await import("@/app/api/interests/[id]/request/route");
      await POST(createPostRequest(), routeContext);

      expect(capturedTx.interest.updateMany).toHaveBeenCalledWith({
        where: {
          id: INTEREST_ID,
          status: { in: ["EXPRESSED", "CONTACT_REQUESTED"] },
        },
        data: { status: "DECLINED" },
      });
    });

    it("同時リクエストでステータス変更済みなら409を返す", async () => {
      mockPrisma.$transaction.mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (callback: (tx: any) => Promise<unknown>) => {
          capturedTx = {
            interest: {
              updateMany: vi.fn().mockResolvedValue({ count: 0 }),
            },
            notification: { create: vi.fn() },
          };
          return callback(capturedTx);
        },
      );

      const { POST } = await import("@/app/api/interests/[id]/request/route");
      const response = await POST(createPostRequest(), routeContext);

      expect(response.status).toBe(409);
      expect(capturedTx.notification.create).not.toHaveBeenCalled();
    });
  });

  describe("ALLOW（自動連絡先開示・ポイント消費）", () => {
    beforeEach(() => {
      mockPrisma.interest.findUnique.mockResolvedValue(mockInterest);
      mockPrisma.companyAccess.findUnique.mockResolvedValue({
        status: "ALLOW",
      });
      mockCheckPointBalance.mockResolvedValue({
        canProceed: true,
        required: 100,
        available: 500,
      });
      mockConsumePointsWithOperations.mockImplementation(
        async (
          _companyId: string,
          _action: string,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          operations: (tx: any) => Promise<unknown>,
        ) => {
          capturedTx = {
            interest: {
              updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
            notification: { create: vi.fn().mockResolvedValue({}) },
          };
          const result = await operations(capturedTx);
          return { newBalance: 400, consumed: 100, result };
        },
      );
    });

    it("自動開示で連絡先を返す", async () => {
      const { POST } = await import("@/app/api/interests/[id]/request/route");
      const response = await POST(createPostRequest(), routeContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe("CONTACT_DISCLOSED");
      expect(data.auto).toBe(true);
      expect(data.contact.email).toBe("test@example.com");
    });

    it("consumePointsWithOperationsにCONTACT_DISCLOSUREで呼ぶ", async () => {
      const { POST } = await import("@/app/api/interests/[id]/request/route");
      await POST(createPostRequest(), routeContext);

      expect(mockConsumePointsWithOperations).toHaveBeenCalledWith(
        COMPANY_ID,
        "CONTACT_DISCLOSURE",
        expect.any(Function),
        INTEREST_ID,
        expect.stringContaining("テスト太郎"),
      );
    });

    it("ポイント不足で402を返す", async () => {
      mockCheckPointBalance.mockResolvedValue({
        canProceed: false,
        required: 100,
        available: 50,
      });

      const { POST } = await import("@/app/api/interests/[id]/request/route");
      const response = await POST(createPostRequest(), routeContext);

      expect(response.status).toBe(402);
      expect(mockConsumePointsWithOperations).not.toHaveBeenCalled();
    });

    it("条件付きupdateManyで開示する（TOCTOU防止）", async () => {
      const { POST } = await import("@/app/api/interests/[id]/request/route");
      await POST(createPostRequest(), routeContext);

      expect(capturedTx.interest.updateMany).toHaveBeenCalledWith({
        where: {
          id: INTEREST_ID,
          status: { in: ["EXPRESSED", "CONTACT_REQUESTED"] },
        },
        data: { status: "CONTACT_DISCLOSED" },
      });
    });

    it("二重リクエストでステータス変更済みなら409（ポイント二重消費防止）", async () => {
      mockConsumePointsWithOperations.mockImplementation(
        async (
          _companyId: string,
          _action: string,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          operations: (tx: any) => Promise<unknown>,
        ) => {
          capturedTx = {
            interest: {
              updateMany: vi.fn().mockResolvedValue({ count: 0 }),
            },
            notification: { create: vi.fn() },
          };
          return operations(capturedTx);
        },
      );

      const { POST } = await import("@/app/api/interests/[id]/request/route");
      const response = await POST(createPostRequest(), routeContext);

      expect(response.status).toBe(409);
      expect(capturedTx.notification.create).not.toHaveBeenCalled();
    });
  });

  describe("CONTACT_REQUESTED（通常リクエスト）", () => {
    beforeEach(() => {
      mockPrisma.interest.findUnique.mockResolvedValue(mockInterest);
      mockPrisma.companyAccess.findUnique.mockResolvedValue(null); // 設定なし
    });

    it("通常の連絡先開示リクエストが成功する", async () => {
      const { POST } = await import("@/app/api/interests/[id]/request/route");
      const response = await POST(createPostRequest(), routeContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe("CONTACT_REQUESTED");
    });

    it("条件付きupdateManyで更新する（TOCTOU防止）", async () => {
      const { POST } = await import("@/app/api/interests/[id]/request/route");
      await POST(createPostRequest(), routeContext);

      expect(capturedTx.interest.updateMany).toHaveBeenCalledWith({
        where: { id: INTEREST_ID, status: "EXPRESSED" },
        data: { status: "CONTACT_REQUESTED" },
      });
    });

    it("既にCONTACT_REQUESTEDならトランザクションをスキップ", async () => {
      mockPrisma.interest.findUnique.mockResolvedValue({
        ...mockInterest,
        status: "CONTACT_REQUESTED",
      });

      const { POST } = await import("@/app/api/interests/[id]/request/route");
      const response = await POST(createPostRequest(), routeContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe("CONTACT_REQUESTED");
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("同時リクエストでステータス変更済みなら409を返す", async () => {
      mockPrisma.$transaction.mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (callback: (tx: any) => Promise<unknown>) => {
          capturedTx = {
            interest: {
              updateMany: vi.fn().mockResolvedValue({ count: 0 }),
            },
            notification: { create: vi.fn() },
          };
          return callback(capturedTx);
        },
      );

      const { POST } = await import("@/app/api/interests/[id]/request/route");
      const response = await POST(createPostRequest(), routeContext);

      expect(response.status).toBe(409);
    });

    it("リクエスト時に候補者に通知を送る", async () => {
      const { POST } = await import("@/app/api/interests/[id]/request/route");
      await POST(createPostRequest(), routeContext);

      expect(capturedTx.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accountId: "user-acc-1",
          type: "SYSTEM",
          title: "連絡先開示のリクエスト",
        }),
      });
    });
  });
});
