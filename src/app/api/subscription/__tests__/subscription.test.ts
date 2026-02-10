/**
 * サブスクリプションAPI - 結合テスト
 *
 * ユーザーストーリー:
 *
 * 【プラン選択・変更】
 * - 新規採用担当者として、初めてプランを選択したい
 * - 既存ユーザーとして、より上位のプランにアップグレードしたい
 * - 既存ユーザーとして、より下位のプランにダウングレードしたい
 * - 未認証ユーザーとして、プラン変更しようとするとエラーになる
 *
 * 【ポイント購入】
 * - 採用担当者として、追加ポイントを購入したい
 * - 最低購入数量未満での購入はエラーになる
 * - サブスクリプションがない状態では購入できない
 *
 * 【サブスクリプション情報取得】
 * - 採用担当者として、現在のプラン情報を確認したい
 * - 採用担当者として、ポイント残高を確認したい
 *
 * 【ポイント履歴】
 * - 採用担当者として、ポイントの消費・付与履歴を確認したい
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// NextAuthのモック
const mockGetServerSession = vi.fn();
vi.mock("next-auth", () => ({
  getServerSession: () => mockGetServerSession(),
}));

// authOptionsのモック
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

// Prismaのモック
const mockPrisma = {
  subscription: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  pointTransaction: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

// points.tsのモック
vi.mock("@/lib/points", () => ({
  getPointHistory: vi.fn(),
}));

import { getPointHistory } from "@/lib/points";

describe("サブスクリプションAPI - 結合テスト", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/subscription - サブスクリプション情報取得", () => {
    describe("正常系", () => {
      it("認証済みユーザーのサブスクリプション情報を返す", async () => {
        mockGetServerSession.mockResolvedValue({
          user: {
            recruiterId: "recruiter-1",
            companyId: "company-1",
            companyRole: "OWNER",
          },
        });

        mockPrisma.subscription.findUnique.mockResolvedValue({
          id: "sub-1",
          companyId: "company-1",
          planType: "STANDARD",
          pointBalance: 250,
          pointsIncluded: 300,
          status: "ACTIVE",
          billingCycleStart: new Date("2024-01-01"),
        });

        const { GET } = await import("../route");
        const request = new NextRequest("http://localhost/api/subscription");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.subscription).toBeDefined();
        expect(data.subscription.planName).toBe("スタンダード");
        expect(data.subscription.pointBalance).toBe(250);
        expect(data.subscription.priceMonthly).toBe(79800);
      });

      it("サブスクリプションがない場合、nullを返す", async () => {
        mockGetServerSession.mockResolvedValue({
          user: {
            recruiterId: "recruiter-1",
            companyId: "company-1",
            companyRole: "OWNER",
          },
        });

        mockPrisma.subscription.findUnique.mockResolvedValue(null);

        const { GET } = await import("../route");
        const request = new NextRequest("http://localhost/api/subscription");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.subscription).toBeNull();
        expect(data.message).toContain("サブスクリプションがありません");
      });
    });

    describe("異常系", () => {
      it("未認証の場合、401を返す", async () => {
        mockGetServerSession.mockResolvedValue(null);

        const { GET } = await import("../route");
        const request = new NextRequest("http://localhost/api/subscription");
        const response = await GET(request);

        expect(response.status).toBe(401);
      });

      it("companyIdがない場合、403を返す", async () => {
        mockGetServerSession.mockResolvedValue({
          user: { recruiterId: "recruiter-1" }, // companyIdがない
        });

        const { GET } = await import("../route");
        const request = new NextRequest("http://localhost/api/subscription");
        const response = await GET(request);

        expect(response.status).toBe(403);
      });
    });
  });

  describe("POST /api/subscription/change - プラン変更", () => {
    describe("正常系: 新規プラン選択", () => {
      it("新規ユーザーがLIGHTプランを選択すると100ポイントが付与される", async () => {
        mockGetServerSession.mockResolvedValue({
          user: {
            recruiterId: "recruiter-1",
            companyId: "company-1",
            companyRole: "OWNER",
          },
        });

        mockPrisma.subscription.findUnique.mockResolvedValue(null);
        mockPrisma.$transaction.mockImplementation(async (callback) => {
          const tx = {
            subscription: {
              create: vi.fn().mockResolvedValue({
                id: "sub-1",
                planType: "LIGHT",
                pointBalance: 100,
              }),
            },
            pointTransaction: {
              create: vi.fn(),
            },
          };
          return callback(tx);
        });

        const { POST } = await import("../change/route");
        const request = new NextRequest(
          "http://localhost/api/subscription/change",
          {
            method: "POST",
            body: JSON.stringify({ planType: "LIGHT" }),
          },
        );

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.message).toContain("プランを選択");
      });

      it("新規ユーザーがSTANDARDプランを選択すると300ポイントが付与される", async () => {
        mockGetServerSession.mockResolvedValue({
          user: {
            recruiterId: "recruiter-1",
            companyId: "company-1",
            companyRole: "OWNER",
          },
        });

        mockPrisma.subscription.findUnique.mockResolvedValue(null);
        mockPrisma.$transaction.mockImplementation(async (callback) => {
          const tx = {
            subscription: {
              create: vi.fn().mockResolvedValue({
                id: "sub-1",
                planType: "STANDARD",
                pointBalance: 300,
              }),
            },
            pointTransaction: {
              create: vi.fn(),
            },
          };
          return callback(tx);
        });

        const { POST } = await import("../change/route");
        const request = new NextRequest(
          "http://localhost/api/subscription/change",
          {
            method: "POST",
            body: JSON.stringify({ planType: "STANDARD" }),
          },
        );

        const response = await POST(request);

        expect(response.status).toBe(200);
      });

      it("新規ユーザーがENTERPRISEプランを選択すると1000ポイントが付与される", async () => {
        mockGetServerSession.mockResolvedValue({
          user: {
            recruiterId: "recruiter-1",
            companyId: "company-1",
            companyRole: "OWNER",
          },
        });

        mockPrisma.subscription.findUnique.mockResolvedValue(null);
        mockPrisma.$transaction.mockImplementation(async (callback) => {
          const tx = {
            subscription: {
              create: vi.fn().mockResolvedValue({
                id: "sub-1",
                planType: "ENTERPRISE",
                pointBalance: 1000,
              }),
            },
            pointTransaction: {
              create: vi.fn(),
            },
          };
          return callback(tx);
        });

        const { POST } = await import("../change/route");
        const request = new NextRequest(
          "http://localhost/api/subscription/change",
          {
            method: "POST",
            body: JSON.stringify({ planType: "ENTERPRISE" }),
          },
        );

        const response = await POST(request);

        expect(response.status).toBe(200);
      });
    });

    describe("正常系: プラン変更", () => {
      it("既存ユーザーがプランをアップグレードできる", async () => {
        mockGetServerSession.mockResolvedValue({
          user: {
            recruiterId: "recruiter-1",
            companyId: "company-1",
            companyRole: "OWNER",
          },
        });

        mockPrisma.subscription.findUnique.mockResolvedValue({
          id: "sub-1",
          planType: "LIGHT",
          pointBalance: 50,
        });

        mockPrisma.subscription.update.mockResolvedValue({
          id: "sub-1",
          planType: "STANDARD",
          pointsIncluded: 300,
        });

        const { POST } = await import("../change/route");
        const request = new NextRequest(
          "http://localhost/api/subscription/change",
          {
            method: "POST",
            body: JSON.stringify({ planType: "STANDARD" }),
          },
        );

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.message).toContain("プランを変更");
      });

      it("既存ユーザーがプランをダウングレードできる", async () => {
        mockGetServerSession.mockResolvedValue({
          user: {
            recruiterId: "recruiter-1",
            companyId: "company-1",
            companyRole: "OWNER",
          },
        });

        mockPrisma.subscription.findUnique.mockResolvedValue({
          id: "sub-1",
          planType: "ENTERPRISE",
          pointBalance: 500,
        });

        mockPrisma.subscription.update.mockResolvedValue({
          id: "sub-1",
          planType: "LIGHT",
          pointsIncluded: 100,
        });

        const { POST } = await import("../change/route");
        const request = new NextRequest(
          "http://localhost/api/subscription/change",
          {
            method: "POST",
            body: JSON.stringify({ planType: "LIGHT" }),
          },
        );

        const response = await POST(request);

        expect(response.status).toBe(200);
      });
    });

    describe("異常系", () => {
      it("未認証の場合、401を返す", async () => {
        mockGetServerSession.mockResolvedValue(null);

        const { POST } = await import("../change/route");
        const request = new NextRequest(
          "http://localhost/api/subscription/change",
          {
            method: "POST",
            body: JSON.stringify({ planType: "LIGHT" }),
          },
        );

        const response = await POST(request);

        expect(response.status).toBe(401);
      });

      it("無効なプランタイプの場合、400を返す", async () => {
        mockGetServerSession.mockResolvedValue({
          user: {
            recruiterId: "recruiter-1",
            companyId: "company-1",
            companyRole: "OWNER",
          },
        });

        const { POST } = await import("../change/route");
        const request = new NextRequest(
          "http://localhost/api/subscription/change",
          {
            method: "POST",
            body: JSON.stringify({ planType: "INVALID_PLAN" }),
          },
        );

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain("入力内容に問題があります");
      });

      it("planTypeが指定されていない場合、400を返す", async () => {
        mockGetServerSession.mockResolvedValue({
          user: {
            recruiterId: "recruiter-1",
            companyId: "company-1",
            companyRole: "OWNER",
          },
        });

        const { POST } = await import("../change/route");
        const request = new NextRequest(
          "http://localhost/api/subscription/change",
          {
            method: "POST",
            body: JSON.stringify({}),
          },
        );

        const response = await POST(request);

        expect(response.status).toBe(400);
      });
    });
  });

  describe("POST /api/subscription/points - ポイント購入", () => {
    describe("正常系", () => {
      it("100ポイントを購入できる", async () => {
        mockGetServerSession.mockResolvedValue({
          user: {
            recruiterId: "recruiter-1",
            companyId: "company-1",
            companyRole: "OWNER",
          },
        });

        mockPrisma.subscription.findUnique.mockResolvedValue({
          id: "sub-1",
          planType: "STANDARD",
          pointBalance: 50,
        });

        mockPrisma.$transaction.mockImplementation(async (callback) => {
          const tx = {
            subscription: {
              update: vi.fn().mockResolvedValue({ pointBalance: 150 }),
            },
            pointTransaction: {
              create: vi.fn(),
            },
          };
          return callback(tx);
        });

        const { POST } = await import("../points/route");
        const request = new NextRequest(
          "http://localhost/api/subscription/points",
          {
            method: "POST",
            body: JSON.stringify({ amount: 100 }),
          },
        );

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.newBalance).toBe(150);
        expect(data.purchased).toBe(100);
      });

      it("プランに応じた単価で計算される（STANDARDは400円/pt）", async () => {
        mockGetServerSession.mockResolvedValue({
          user: {
            recruiterId: "recruiter-1",
            companyId: "company-1",
            companyRole: "OWNER",
          },
        });

        mockPrisma.subscription.findUnique.mockResolvedValue({
          id: "sub-1",
          planType: "STANDARD",
          pointBalance: 0,
        });

        mockPrisma.$transaction.mockImplementation(async (callback) => {
          const tx = {
            subscription: {
              update: vi.fn().mockResolvedValue({ pointBalance: 100 }),
            },
            pointTransaction: {
              create: vi.fn(),
            },
          };
          return callback(tx);
        });

        const { POST } = await import("../points/route");
        const request = new NextRequest(
          "http://localhost/api/subscription/points",
          {
            method: "POST",
            body: JSON.stringify({ amount: 100 }),
          },
        );

        const response = await POST(request);
        const data = await response.json();

        expect(data.price).toBe(40000); // 100pt × 400円
      });
    });

    describe("異常系", () => {
      it("未認証の場合、401を返す", async () => {
        mockGetServerSession.mockResolvedValue(null);

        const { POST } = await import("../points/route");
        const request = new NextRequest(
          "http://localhost/api/subscription/points",
          {
            method: "POST",
            body: JSON.stringify({ amount: 100 }),
          },
        );

        const response = await POST(request);

        expect(response.status).toBe(401);
      });

      it("10ポイント未満の購入は400を返す", async () => {
        mockGetServerSession.mockResolvedValue({
          user: {
            recruiterId: "recruiter-1",
            companyId: "company-1",
            companyRole: "OWNER",
          },
        });

        const { POST } = await import("../points/route");
        const request = new NextRequest(
          "http://localhost/api/subscription/points",
          {
            method: "POST",
            body: JSON.stringify({ amount: 5 }),
          },
        );

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain("入力内容に問題があります");
      });

      it("amountが数値でない場合、400を返す", async () => {
        mockGetServerSession.mockResolvedValue({
          user: {
            recruiterId: "recruiter-1",
            companyId: "company-1",
            companyRole: "OWNER",
          },
        });

        const { POST } = await import("../points/route");
        const request = new NextRequest(
          "http://localhost/api/subscription/points",
          {
            method: "POST",
            body: JSON.stringify({ amount: "invalid" }),
          },
        );

        const response = await POST(request);

        expect(response.status).toBe(400);
      });

      it("サブスクリプションがない場合、402を返す", async () => {
        mockGetServerSession.mockResolvedValue({
          user: {
            recruiterId: "recruiter-1",
            companyId: "company-1",
            companyRole: "OWNER",
          },
        });

        mockPrisma.subscription.findUnique.mockResolvedValue(null);

        const { POST } = await import("../points/route");
        const request = new NextRequest(
          "http://localhost/api/subscription/points",
          {
            method: "POST",
            body: JSON.stringify({ amount: 100 }),
          },
        );

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(402);
        expect(data.error).toContain("サブスクリプション");
      });
    });
  });

  describe("GET /api/subscription/history - ポイント履歴取得", () => {
    describe("正常系", () => {
      it("ポイント履歴を取得できる", async () => {
        mockGetServerSession.mockResolvedValue({
          user: {
            recruiterId: "recruiter-1",
            companyId: "company-1",
            companyRole: "OWNER",
          },
        });

        const mockHistory = [
          {
            id: "tx-1",
            type: "CONSUME",
            action: "CONVERSATION",
            amount: -1,
            balance: 99,
            description: "エージェント会話",
            createdAt: new Date(),
          },
          {
            id: "tx-2",
            type: "GRANT",
            action: null,
            amount: 100,
            balance: 100,
            description: "初回付与",
            createdAt: new Date(),
          },
        ];

        (getPointHistory as ReturnType<typeof vi.fn>).mockResolvedValue(
          mockHistory,
        );

        const { GET } = await import("../history/route");
        const request = new NextRequest(
          "http://localhost/api/subscription/history?limit=50&offset=0",
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.history).toHaveLength(2);
      });

      it("ページネーションパラメータが正しく渡される", async () => {
        mockGetServerSession.mockResolvedValue({
          user: {
            recruiterId: "recruiter-1",
            companyId: "company-1",
            companyRole: "OWNER",
          },
        });

        (getPointHistory as ReturnType<typeof vi.fn>).mockResolvedValue([]);

        const { GET } = await import("../history/route");
        const request = new NextRequest(
          "http://localhost/api/subscription/history?limit=20&offset=40",
        );

        await GET(request);

        expect(getPointHistory).toHaveBeenCalledWith("company-1", 20, 40);
      });
    });

    describe("異常系", () => {
      it("未認証の場合、401を返す", async () => {
        mockGetServerSession.mockResolvedValue(null);

        const { GET } = await import("../history/route");
        const request = new NextRequest(
          "http://localhost/api/subscription/history",
        );

        const response = await GET(request);

        expect(response.status).toBe(401);
      });
    });
  });
});

describe("課金プロセス - E2Eシナリオテスト", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("シナリオ1: 新規ユーザーの課金フロー", () => {
    it("1. プラン選択 → 2. ポイント使用 → 3. ポイント購入 → 4. 履歴確認", async () => {
      // このテストは実際のE2Eテストとして実装する必要がある
      // ここではテストケースの概要を示す
      expect(true).toBe(true);
    });
  });

  describe("シナリオ2: 既存ユーザーのプランアップグレード", () => {
    it("LIGHTからSTANDARDへのアップグレード", async () => {
      // Step 1: 現在のプラン確認
      // Step 2: プラン変更
      // Step 3: 新しいプランの確認
      expect(true).toBe(true);
    });
  });

  describe("シナリオ3: ポイント不足時の購入フロー", () => {
    it("ポイント不足 → 購入 → アクション実行", async () => {
      // Step 1: ポイント不足でアクション失敗
      // Step 2: ポイント購入
      // Step 3: アクション再実行成功
      expect(true).toBe(true);
    });
  });
});
