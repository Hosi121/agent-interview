/**
 * 連絡先開示フロー - 結合テスト
 *
 * 【approve】連絡先開示の承認
 * 【decline】連絡先開示の辞退
 * 【inbox】受信した興味表明一覧の取得
 * 【messages】メッセージ送受信
 * 【request】連絡先開示リクエスト
 * 【company-access】CompanyAccess管理
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// NextAuthのモック
const mockGetServerSession = vi.fn();
vi.mock("next-auth", () => ({
  getServerSession: () => mockGetServerSession(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

// Prismaのモック
const mockTxClient = {
  interest: {
    update: vi.fn(),
  },
  companyAccess: {
    upsert: vi.fn(),
  },
  notification: {
    create: vi.fn(),
  },
  directMessage: {
    create: vi.fn(),
  },
  subscription: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  pointTransaction: {
    create: vi.fn(),
  },
};

const mockPrisma = {
  interest: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  companyAccess: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
  notification: {
    create: vi.fn(),
  },
  directMessage: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  company: {
    findUnique: vi.fn(),
  },
  subscription: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

// pointsモック
const mockCheckPointBalance = vi.fn();
const mockConsumePointsWithOperations = vi.fn();
vi.mock("@/lib/points", () => ({
  checkPointBalance: (...args: unknown[]) => mockCheckPointBalance(...args),
  consumePointsWithOperations: (...args: unknown[]) =>
    mockConsumePointsWithOperations(...args),
}));

// テスト用データ
const mockInterest = {
  id: "interest-1",
  userId: "user-1",
  recruiterId: "recruiter-1",
  status: "CONTACT_REQUESTED",
  message: "興味があります",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  user: {
    id: "user-1",
    name: "テスト太郎",
    email: "taro@example.com",
    phone: "090-1234-5678",
    accountId: "account-user-1",
  },
  recruiter: {
    id: "recruiter-1",
    companyId: "company-1",
    accountId: "account-recruiter-1",
    company: {
      name: "テスト株式会社",
    },
  },
};

const userSession = {
  user: {
    accountId: "account-user-1",
    userId: "user-1",
  },
};

const recruiterSession = {
  user: {
    accountId: "account-recruiter-1",
    recruiterId: "recruiter-1",
    companyId: "company-1",
    companyRole: "OWNER",
    recruiterStatus: "ACTIVE",
  },
};

describe("連絡先開示フロー - 結合テスト", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルトのトランザクション実装: コールバックにtxクライアントを渡す
    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mockTxClient) => Promise<unknown>) => {
        return callback(mockTxClient);
      },
    );
  });

  // =========================================================
  // approve
  // =========================================================
  describe("POST /api/applicant/inbox/[interestId]/approve", () => {
    describe("正常系", () => {
      it("連絡先開示を承認できる", async () => {
        mockGetServerSession.mockResolvedValue(userSession);
        mockPrisma.interest.findUnique.mockResolvedValue(mockInterest);
        mockCheckPointBalance.mockResolvedValue({
          canProceed: true,
          required: 10,
          available: 100,
        });
        mockConsumePointsWithOperations.mockImplementation(
          async (
            _companyId: string,
            _action: string,
            operations: (tx: typeof mockTxClient) => Promise<void>,
          ) => {
            await operations(mockTxClient);
            return { newBalance: 90, consumed: 10, result: undefined };
          },
        );

        const { POST } = await import(
          "@/app/api/applicant/inbox/[interestId]/approve/route"
        );
        const request = new NextRequest(
          "http://localhost/api/applicant/inbox/interest-1/approve",
          {
            method: "POST",
            body: JSON.stringify({}),
          },
        );

        const response = await POST(request, {
          params: Promise.resolve({ interestId: "interest-1" }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.status).toBe("CONTACT_DISCLOSED");
        expect(data.contact).toBeDefined();
        expect(data.contact.email).toBe("taro@example.com");
      });

      it("ALLOWプリファレンスでCompanyAccessが作成される", async () => {
        mockGetServerSession.mockResolvedValue(userSession);
        mockPrisma.interest.findUnique.mockResolvedValue(mockInterest);
        mockCheckPointBalance.mockResolvedValue({
          canProceed: true,
          required: 10,
          available: 100,
        });
        mockConsumePointsWithOperations.mockImplementation(
          async (
            _companyId: string,
            _action: string,
            operations: (tx: typeof mockTxClient) => Promise<void>,
          ) => {
            await operations(mockTxClient);
            return { newBalance: 90, consumed: 10, result: undefined };
          },
        );

        const { POST } = await import(
          "@/app/api/applicant/inbox/[interestId]/approve/route"
        );
        const request = new NextRequest(
          "http://localhost/api/applicant/inbox/interest-1/approve",
          {
            method: "POST",
            body: JSON.stringify({ preference: "ALLOW" }),
          },
        );

        const response = await POST(request, {
          params: Promise.resolve({ interestId: "interest-1" }),
        });

        expect(response.status).toBe(200);
        expect(mockTxClient.companyAccess.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({ status: "ALLOW" }),
          }),
        );
      });

      it("既に開示済みの場合は連絡先を返す", async () => {
        mockGetServerSession.mockResolvedValue(userSession);
        mockPrisma.interest.findUnique.mockResolvedValue({
          ...mockInterest,
          status: "CONTACT_DISCLOSED",
        });

        const { POST } = await import(
          "@/app/api/applicant/inbox/[interestId]/approve/route"
        );
        const request = new NextRequest(
          "http://localhost/api/applicant/inbox/interest-1/approve",
          {
            method: "POST",
            body: JSON.stringify({}),
          },
        );

        const response = await POST(request, {
          params: Promise.resolve({ interestId: "interest-1" }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.status).toBe("CONTACT_DISCLOSED");
      });
    });

    describe("異常系", () => {
      it("未認証の場合401を返す", async () => {
        mockGetServerSession.mockResolvedValue(null);

        const { POST } = await import(
          "@/app/api/applicant/inbox/[interestId]/approve/route"
        );
        const request = new NextRequest(
          "http://localhost/api/applicant/inbox/interest-1/approve",
          { method: "POST", body: JSON.stringify({}) },
        );

        const response = await POST(request, {
          params: Promise.resolve({ interestId: "interest-1" }),
        });

        expect(response.status).toBe(401);
      });

      it("他人の興味表明には403を返す", async () => {
        mockGetServerSession.mockResolvedValue({
          user: { userId: "other-user", accountId: "account-other" },
        });
        mockPrisma.interest.findUnique.mockResolvedValue(mockInterest);

        const { POST } = await import(
          "@/app/api/applicant/inbox/[interestId]/approve/route"
        );
        const request = new NextRequest(
          "http://localhost/api/applicant/inbox/interest-1/approve",
          { method: "POST", body: JSON.stringify({}) },
        );

        const response = await POST(request, {
          params: Promise.resolve({ interestId: "interest-1" }),
        });

        expect(response.status).toBe(403);
      });

      it("辞退済みの場合409を返す", async () => {
        mockGetServerSession.mockResolvedValue(userSession);
        mockPrisma.interest.findUnique.mockResolvedValue({
          ...mockInterest,
          status: "DECLINED",
        });

        const { POST } = await import(
          "@/app/api/applicant/inbox/[interestId]/approve/route"
        );
        const request = new NextRequest(
          "http://localhost/api/applicant/inbox/interest-1/approve",
          { method: "POST", body: JSON.stringify({}) },
        );

        const response = await POST(request, {
          params: Promise.resolve({ interestId: "interest-1" }),
        });

        expect(response.status).toBe(409);
      });

      it("存在しない興味表明には404を返す", async () => {
        mockGetServerSession.mockResolvedValue(userSession);
        mockPrisma.interest.findUnique.mockResolvedValue(null);

        const { POST } = await import(
          "@/app/api/applicant/inbox/[interestId]/approve/route"
        );
        const request = new NextRequest(
          "http://localhost/api/applicant/inbox/interest-1/approve",
          { method: "POST", body: JSON.stringify({}) },
        );

        const response = await POST(request, {
          params: Promise.resolve({ interestId: "interest-1" }),
        });

        expect(response.status).toBe(404);
      });
    });
  });

  // =========================================================
  // decline
  // =========================================================
  describe("POST /api/applicant/inbox/[interestId]/decline", () => {
    describe("正常系", () => {
      it("連絡先開示を辞退できる", async () => {
        mockGetServerSession.mockResolvedValue(userSession);
        mockPrisma.interest.findUnique.mockResolvedValue(mockInterest);

        const { POST } = await import(
          "@/app/api/applicant/inbox/[interestId]/decline/route"
        );
        const request = new NextRequest(
          "http://localhost/api/applicant/inbox/interest-1/decline",
          {
            method: "POST",
            body: JSON.stringify({}),
          },
        );

        const response = await POST(request, {
          params: Promise.resolve({ interestId: "interest-1" }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.status).toBe("DECLINED");
        // トランザクション内で実行されることを確認
        expect(mockPrisma.$transaction).toHaveBeenCalled();
        expect(mockTxClient.interest.update).toHaveBeenCalled();
        expect(mockTxClient.notification.create).toHaveBeenCalled();
      });

      it("DENYプリファレンスでCompanyAccessが作成される", async () => {
        mockGetServerSession.mockResolvedValue(userSession);
        mockPrisma.interest.findUnique.mockResolvedValue(mockInterest);

        const { POST } = await import(
          "@/app/api/applicant/inbox/[interestId]/decline/route"
        );
        const request = new NextRequest(
          "http://localhost/api/applicant/inbox/interest-1/decline",
          {
            method: "POST",
            body: JSON.stringify({ preference: "DENY" }),
          },
        );

        const response = await POST(request, {
          params: Promise.resolve({ interestId: "interest-1" }),
        });

        expect(response.status).toBe(200);
        expect(mockTxClient.companyAccess.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({ status: "DENY" }),
          }),
        );
      });

      it("既に辞退済みの場合でもステータス更新をスキップする", async () => {
        mockGetServerSession.mockResolvedValue(userSession);
        mockPrisma.interest.findUnique.mockResolvedValue({
          ...mockInterest,
          status: "DECLINED",
        });

        const { POST } = await import(
          "@/app/api/applicant/inbox/[interestId]/decline/route"
        );
        const request = new NextRequest(
          "http://localhost/api/applicant/inbox/interest-1/decline",
          { method: "POST", body: JSON.stringify({}) },
        );

        const response = await POST(request, {
          params: Promise.resolve({ interestId: "interest-1" }),
        });

        expect(response.status).toBe(200);
        // ステータス更新はスキップされるが通知は作成される
        expect(mockTxClient.interest.update).not.toHaveBeenCalled();
        expect(mockTxClient.notification.create).toHaveBeenCalled();
      });
    });

    describe("異常系", () => {
      it("既に開示済みの場合409を返す", async () => {
        mockGetServerSession.mockResolvedValue(userSession);
        mockPrisma.interest.findUnique.mockResolvedValue({
          ...mockInterest,
          status: "CONTACT_DISCLOSED",
        });

        const { POST } = await import(
          "@/app/api/applicant/inbox/[interestId]/decline/route"
        );
        const request = new NextRequest(
          "http://localhost/api/applicant/inbox/interest-1/decline",
          { method: "POST", body: JSON.stringify({}) },
        );

        const response = await POST(request, {
          params: Promise.resolve({ interestId: "interest-1" }),
        });

        expect(response.status).toBe(409);
      });

      it("他人の興味表明には403を返す", async () => {
        mockGetServerSession.mockResolvedValue({
          user: { userId: "other-user", accountId: "account-other" },
        });
        mockPrisma.interest.findUnique.mockResolvedValue(mockInterest);

        const { POST } = await import(
          "@/app/api/applicant/inbox/[interestId]/decline/route"
        );
        const request = new NextRequest(
          "http://localhost/api/applicant/inbox/interest-1/decline",
          { method: "POST", body: JSON.stringify({}) },
        );

        const response = await POST(request, {
          params: Promise.resolve({ interestId: "interest-1" }),
        });

        expect(response.status).toBe(403);
      });
    });
  });

  // =========================================================
  // inbox
  // =========================================================
  describe("GET /api/applicant/inbox", () => {
    describe("正常系", () => {
      it("受信した興味表明一覧を取得できる", async () => {
        mockGetServerSession.mockResolvedValue(userSession);
        mockPrisma.interest.findMany.mockResolvedValue([
          {
            id: "interest-1",
            status: "CONTACT_REQUESTED",
            message: "興味があります",
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-02"),
            recruiter: {
              id: "recruiter-1",
              company: { name: "テスト株式会社" },
            },
            directMessages: [],
            _count: { directMessages: 0 },
          },
        ]);

        const { GET } = await import("@/app/api/applicant/inbox/route");
        const request = new NextRequest("http://localhost/api/applicant/inbox");

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.interests).toHaveLength(1);
        expect(data.interests[0].recruiter.companyName).toBe("テスト株式会社");
      });

      it("空の一覧を返せる", async () => {
        mockGetServerSession.mockResolvedValue(userSession);
        mockPrisma.interest.findMany.mockResolvedValue([]);

        const { GET } = await import("@/app/api/applicant/inbox/route");
        const request = new NextRequest("http://localhost/api/applicant/inbox");

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.interests).toHaveLength(0);
      });
    });

    describe("異常系", () => {
      it("未認証の場合401を返す", async () => {
        mockGetServerSession.mockResolvedValue(null);

        const { GET } = await import("@/app/api/applicant/inbox/route");
        const request = new NextRequest("http://localhost/api/applicant/inbox");

        const response = await GET(request);

        expect(response.status).toBe(401);
      });
    });
  });

  // =========================================================
  // applicant messages
  // =========================================================
  describe("POST /api/applicant/inbox/[interestId]/messages", () => {
    describe("正常系", () => {
      it("求職者がメッセージを送信できる", async () => {
        mockGetServerSession.mockResolvedValue(userSession);
        mockPrisma.interest.findFirst.mockResolvedValue({
          ...mockInterest,
          status: "CONTACT_DISCLOSED",
        });

        const createdMessage = {
          id: "msg-1",
          content: "こんにちは",
          senderType: "USER",
          createdAt: new Date(),
          user: { name: "テスト太郎" },
        };
        mockTxClient.directMessage.create.mockResolvedValue(createdMessage);

        const { POST } = await import(
          "@/app/api/applicant/inbox/[interestId]/messages/route"
        );
        const request = new NextRequest(
          "http://localhost/api/applicant/inbox/interest-1/messages",
          {
            method: "POST",
            body: JSON.stringify({ content: "こんにちは" }),
          },
        );

        const response = await POST(request, {
          params: Promise.resolve({ interestId: "interest-1" }),
        });
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.message.content).toBe("こんにちは");
        // トランザクション内で実行されることを確認
        expect(mockPrisma.$transaction).toHaveBeenCalled();
        expect(mockTxClient.notification.create).toHaveBeenCalled();
        expect(mockTxClient.interest.update).toHaveBeenCalled();
      });
    });

    describe("異常系", () => {
      it("連絡先未開示の場合403を返す", async () => {
        mockGetServerSession.mockResolvedValue(userSession);
        mockPrisma.interest.findFirst.mockResolvedValue(null);

        const { POST } = await import(
          "@/app/api/applicant/inbox/[interestId]/messages/route"
        );
        const request = new NextRequest(
          "http://localhost/api/applicant/inbox/interest-1/messages",
          {
            method: "POST",
            body: JSON.stringify({ content: "こんにちは" }),
          },
        );

        const response = await POST(request, {
          params: Promise.resolve({ interestId: "interest-1" }),
        });

        expect(response.status).toBe(403);
      });

      it("空メッセージの場合400を返す", async () => {
        mockGetServerSession.mockResolvedValue(userSession);

        const { POST } = await import(
          "@/app/api/applicant/inbox/[interestId]/messages/route"
        );
        const request = new NextRequest(
          "http://localhost/api/applicant/inbox/interest-1/messages",
          {
            method: "POST",
            body: JSON.stringify({ content: "" }),
          },
        );

        const response = await POST(request, {
          params: Promise.resolve({ interestId: "interest-1" }),
        });

        expect(response.status).toBe(400);
      });
    });
  });

  // =========================================================
  // request (recruiter side)
  // =========================================================
  describe("POST /api/interests/[id]/request", () => {
    describe("正常系", () => {
      it("連絡先開示をリクエストできる", async () => {
        mockGetServerSession.mockResolvedValue(recruiterSession);
        mockPrisma.interest.findUnique.mockResolvedValue({
          ...mockInterest,
          status: "INTERESTED",
        });
        mockPrisma.companyAccess.findUnique.mockResolvedValue(null);

        const { POST } = await import("@/app/api/interests/[id]/request/route");
        const request = new NextRequest(
          "http://localhost/api/interests/interest-1/request",
          { method: "POST" },
        );

        const response = await POST(request, {
          params: Promise.resolve({ id: "interest-1" }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.status).toBe("CONTACT_REQUESTED");
        // トランザクション内で実行されることを確認
        expect(mockPrisma.$transaction).toHaveBeenCalled();
      });

      it("DENY設定がある場合は自動辞退する", async () => {
        mockGetServerSession.mockResolvedValue(recruiterSession);
        mockPrisma.interest.findUnique.mockResolvedValue({
          ...mockInterest,
          status: "INTERESTED",
        });
        mockPrisma.companyAccess.findUnique.mockResolvedValue({
          status: "DENY",
        });

        const { POST } = await import("@/app/api/interests/[id]/request/route");
        const request = new NextRequest(
          "http://localhost/api/interests/interest-1/request",
          { method: "POST" },
        );

        const response = await POST(request, {
          params: Promise.resolve({ id: "interest-1" }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.status).toBe("DECLINED");
        expect(data.auto).toBe(true);
        // トランザクション内で実行されることを確認
        expect(mockPrisma.$transaction).toHaveBeenCalled();
      });

      it("ALLOW設定がある場合はポイント消費して自動開示する", async () => {
        mockGetServerSession.mockResolvedValue(recruiterSession);
        mockPrisma.interest.findUnique.mockResolvedValue({
          ...mockInterest,
          status: "INTERESTED",
        });
        mockPrisma.companyAccess.findUnique.mockResolvedValue({
          status: "ALLOW",
        });
        mockCheckPointBalance.mockResolvedValue({
          canProceed: true,
          required: 10,
          available: 100,
        });
        mockConsumePointsWithOperations.mockImplementation(
          async (
            _companyId: string,
            _action: string,
            operations: (tx: typeof mockTxClient) => Promise<void>,
          ) => {
            await operations(mockTxClient);
            return { newBalance: 90, consumed: 10, result: undefined };
          },
        );

        const { POST } = await import("@/app/api/interests/[id]/request/route");
        const request = new NextRequest(
          "http://localhost/api/interests/interest-1/request",
          { method: "POST" },
        );

        const response = await POST(request, {
          params: Promise.resolve({ id: "interest-1" }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.status).toBe("CONTACT_DISCLOSED");
        expect(data.auto).toBe(true);
        expect(data.contact).toBeDefined();
      });

      it("既に開示済みの場合は連絡先を返す", async () => {
        mockGetServerSession.mockResolvedValue(recruiterSession);
        mockPrisma.interest.findUnique.mockResolvedValue({
          ...mockInterest,
          status: "CONTACT_DISCLOSED",
        });

        const { POST } = await import("@/app/api/interests/[id]/request/route");
        const request = new NextRequest(
          "http://localhost/api/interests/interest-1/request",
          { method: "POST" },
        );

        const response = await POST(request, {
          params: Promise.resolve({ id: "interest-1" }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.contact).toBeDefined();
      });
    });

    describe("異常系", () => {
      it("辞退済みの場合409を返す", async () => {
        mockGetServerSession.mockResolvedValue(recruiterSession);
        mockPrisma.interest.findUnique.mockResolvedValue({
          ...mockInterest,
          status: "DECLINED",
        });

        const { POST } = await import("@/app/api/interests/[id]/request/route");
        const request = new NextRequest(
          "http://localhost/api/interests/interest-1/request",
          { method: "POST" },
        );

        const response = await POST(request, {
          params: Promise.resolve({ id: "interest-1" }),
        });

        expect(response.status).toBe(409);
      });

      it("ALLOW設定でポイント不足の場合402を返す", async () => {
        mockGetServerSession.mockResolvedValue(recruiterSession);
        mockPrisma.interest.findUnique.mockResolvedValue({
          ...mockInterest,
          status: "INTERESTED",
        });
        mockPrisma.companyAccess.findUnique.mockResolvedValue({
          status: "ALLOW",
        });
        mockCheckPointBalance.mockResolvedValue({
          canProceed: false,
          required: 10,
          available: 5,
        });

        const { POST } = await import("@/app/api/interests/[id]/request/route");
        const request = new NextRequest(
          "http://localhost/api/interests/interest-1/request",
          { method: "POST" },
        );

        const response = await POST(request, {
          params: Promise.resolve({ id: "interest-1" }),
        });

        expect(response.status).toBe(402);
      });

      it("他人の興味表明には403を返す", async () => {
        mockGetServerSession.mockResolvedValue({
          user: {
            recruiterId: "other-recruiter",
            companyId: "company-1",
            companyRole: "OWNER",
            recruiterStatus: "ACTIVE",
          },
        });
        mockPrisma.interest.findUnique.mockResolvedValue(mockInterest);

        const { POST } = await import("@/app/api/interests/[id]/request/route");
        const request = new NextRequest(
          "http://localhost/api/interests/interest-1/request",
          { method: "POST" },
        );

        const response = await POST(request, {
          params: Promise.resolve({ id: "interest-1" }),
        });

        expect(response.status).toBe(403);
      });
    });
  });

  // =========================================================
  // CompanyAccess管理
  // =========================================================
  describe("CompanyAccess管理 API", () => {
    describe("GET /api/applicant/company-access", () => {
      it("アクセス設定一覧を取得できる", async () => {
        mockGetServerSession.mockResolvedValue(userSession);
        mockPrisma.companyAccess.findMany.mockResolvedValue([
          {
            id: "access-1",
            companyId: "company-1",
            status: "ALLOW",
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
            company: { id: "company-1", name: "テスト株式会社" },
          },
          {
            id: "access-2",
            companyId: "company-2",
            status: "DENY",
            createdAt: new Date("2024-01-02"),
            updatedAt: new Date("2024-01-02"),
            company: { id: "company-2", name: "サンプル社" },
          },
        ]);

        const { GET } = await import(
          "@/app/api/applicant/company-access/route"
        );
        const request = new NextRequest(
          "http://localhost/api/applicant/company-access",
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.accessList).toHaveLength(2);
        expect(data.accessList[0].companyName).toBe("テスト株式会社");
        expect(data.accessList[1].status).toBe("DENY");
      });

      it("空一覧を返せる", async () => {
        mockGetServerSession.mockResolvedValue(userSession);
        mockPrisma.companyAccess.findMany.mockResolvedValue([]);

        const { GET } = await import(
          "@/app/api/applicant/company-access/route"
        );
        const request = new NextRequest(
          "http://localhost/api/applicant/company-access",
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.accessList).toHaveLength(0);
      });
    });

    describe("PATCH /api/applicant/company-access", () => {
      it("アクセス設定をALLOWに変更できる", async () => {
        mockGetServerSession.mockResolvedValue(userSession);
        mockPrisma.company.findUnique.mockResolvedValue({
          id: "company-1",
          name: "テスト株式会社",
        });
        mockPrisma.companyAccess.upsert.mockResolvedValue({
          id: "access-1",
          companyId: "company-1",
          status: "ALLOW",
          updatedAt: new Date(),
          company: { name: "テスト株式会社" },
        });

        const { PATCH } = await import(
          "@/app/api/applicant/company-access/route"
        );
        const request = new NextRequest(
          "http://localhost/api/applicant/company-access",
          {
            method: "PATCH",
            body: JSON.stringify({
              companyId: "company-1",
              status: "ALLOW",
            }),
          },
        );

        const response = await PATCH(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.status).toBe("ALLOW");
        expect(data.companyName).toBe("テスト株式会社");
      });

      it("アクセス設定をDENYに変更できる", async () => {
        mockGetServerSession.mockResolvedValue(userSession);
        mockPrisma.company.findUnique.mockResolvedValue({
          id: "company-1",
          name: "テスト株式会社",
        });
        mockPrisma.companyAccess.upsert.mockResolvedValue({
          id: "access-1",
          companyId: "company-1",
          status: "DENY",
          updatedAt: new Date(),
          company: { name: "テスト株式会社" },
        });

        const { PATCH } = await import(
          "@/app/api/applicant/company-access/route"
        );
        const request = new NextRequest(
          "http://localhost/api/applicant/company-access",
          {
            method: "PATCH",
            body: JSON.stringify({
              companyId: "company-1",
              status: "DENY",
            }),
          },
        );

        const response = await PATCH(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.status).toBe("DENY");
      });

      it("存在しない企業には404を返す", async () => {
        mockGetServerSession.mockResolvedValue(userSession);
        mockPrisma.company.findUnique.mockResolvedValue(null);

        const { PATCH } = await import(
          "@/app/api/applicant/company-access/route"
        );
        const request = new NextRequest(
          "http://localhost/api/applicant/company-access",
          {
            method: "PATCH",
            body: JSON.stringify({
              companyId: "nonexistent",
              status: "ALLOW",
            }),
          },
        );

        const response = await PATCH(request);

        expect(response.status).toBe(404);
      });

      it("不正なステータスの場合400を返す", async () => {
        mockGetServerSession.mockResolvedValue(userSession);

        const { PATCH } = await import(
          "@/app/api/applicant/company-access/route"
        );
        const request = new NextRequest(
          "http://localhost/api/applicant/company-access",
          {
            method: "PATCH",
            body: JSON.stringify({
              companyId: "company-1",
              status: "INVALID",
            }),
          },
        );

        const response = await PATCH(request);

        expect(response.status).toBe(400);
      });
    });

    describe("DELETE /api/applicant/company-access", () => {
      it("アクセス設定を削除できる", async () => {
        mockGetServerSession.mockResolvedValue(userSession);
        mockPrisma.companyAccess.findUnique.mockResolvedValue({
          id: "access-1",
          userId: "user-1",
          companyId: "company-1",
          status: "DENY",
        });

        const { DELETE } = await import(
          "@/app/api/applicant/company-access/route"
        );
        const request = new NextRequest(
          "http://localhost/api/applicant/company-access",
          {
            method: "DELETE",
            body: JSON.stringify({ companyId: "company-1" }),
          },
        );

        const response = await DELETE(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.deleted).toBe(true);
        expect(mockPrisma.companyAccess.delete).toHaveBeenCalled();
      });

      it("存在しない設定の削除には404を返す", async () => {
        mockGetServerSession.mockResolvedValue(userSession);
        mockPrisma.companyAccess.findUnique.mockResolvedValue(null);

        const { DELETE } = await import(
          "@/app/api/applicant/company-access/route"
        );
        const request = new NextRequest(
          "http://localhost/api/applicant/company-access",
          {
            method: "DELETE",
            body: JSON.stringify({ companyId: "nonexistent" }),
          },
        );

        const response = await DELETE(request);

        expect(response.status).toBe(404);
      });

      it("companyIdが未指定の場合400を返す", async () => {
        mockGetServerSession.mockResolvedValue(userSession);

        const { DELETE } = await import(
          "@/app/api/applicant/company-access/route"
        );
        const request = new NextRequest(
          "http://localhost/api/applicant/company-access",
          {
            method: "DELETE",
            body: JSON.stringify({}),
          },
        );

        const response = await DELETE(request);

        expect(response.status).toBe(400);
      });
    });
  });
});
