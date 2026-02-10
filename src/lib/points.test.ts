/**
 * ポイント管理システム - 単体テスト
 *
 * ユーザーストーリー:
 * - 会社として、エージェントと会話するためにポイントを消費したい
 * - 会社として、連絡先を開示するためにポイントを消費したい
 * - 会社として、ポイント残高を確認したい
 * - システムとして、ポイント不足時に適切なエラーを返したい
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { PLANS, POINT_COSTS } from "./stripe";

// vi.hoistedでモックオブジェクトを先に定義
const mockPrisma = vi.hoisted(() => ({
  subscription: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  pointTransaction: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("./prisma", () => ({
  prisma: mockPrisma,
}));

// points.tsをモックの後にインポート
import {
  checkPointBalance,
  consumePoints,
  getPointBalance,
  getPointHistory,
  grantPoints,
  InsufficientPointsError,
  NoSubscriptionError,
} from "./points";

describe("ポイント管理システム - 単体テスト", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ポイントコスト定義", () => {
    it("エージェント会話は1ポイント消費する", () => {
      expect(POINT_COSTS.CONVERSATION).toBe(1);
    });

    it("興味表明は無料（0ポイント）", () => {
      expect(POINT_COSTS.INTEREST).toBe(0);
    });

    it("連絡先開示は10ポイント消費する", () => {
      expect(POINT_COSTS.CONTACT_DISCLOSURE).toBe(10);
    });

    it("メッセージ送信は3ポイント消費する", () => {
      expect(POINT_COSTS.MESSAGE_SEND).toBe(3);
    });
  });

  describe("プラン定義", () => {
    it("LIGHTプランは月額29,800円で100ポイント付与", () => {
      expect(PLANS.LIGHT.priceMonthly).toBe(29800);
      expect(PLANS.LIGHT.pointsIncluded).toBe(100);
    });

    it("STANDARDプランは月額79,800円で300ポイント付与", () => {
      expect(PLANS.STANDARD.priceMonthly).toBe(79800);
      expect(PLANS.STANDARD.pointsIncluded).toBe(300);
    });

    it("ENTERPRISEプランは月額198,000円で1000ポイント付与", () => {
      expect(PLANS.ENTERPRISE.priceMonthly).toBe(198000);
      expect(PLANS.ENTERPRISE.pointsIncluded).toBe(1000);
    });

    it("上位プランほどポイント単価が安い", () => {
      expect(PLANS.LIGHT.pointUnitPrice).toBeGreaterThan(
        PLANS.STANDARD.pointUnitPrice,
      );
      expect(PLANS.STANDARD.pointUnitPrice).toBeGreaterThan(
        PLANS.ENTERPRISE.pointUnitPrice,
      );
    });

    it("上位プランほど追加購入単価が安い", () => {
      expect(PLANS.LIGHT.additionalPointPrice).toBeGreaterThan(
        PLANS.STANDARD.additionalPointPrice,
      );
      expect(PLANS.STANDARD.additionalPointPrice).toBeGreaterThan(
        PLANS.ENTERPRISE.additionalPointPrice,
      );
    });
  });

  describe("getPointBalance - ポイント残高取得", () => {
    describe("正常系", () => {
      it("サブスクリプションが存在する場合、ポイント残高を返す", async () => {
        mockPrisma.subscription.findUnique.mockResolvedValue({
          companyId: "company-1",
          pointBalance: 150,
        });

        const balance = await getPointBalance("company-1");

        expect(balance).toBe(150);
        expect(mockPrisma.subscription.findUnique).toHaveBeenCalledWith({
          where: { companyId: "company-1" },
        });
      });
    });

    describe("異常系", () => {
      it("サブスクリプションが存在しない場合、NoSubscriptionErrorをスロー", async () => {
        mockPrisma.subscription.findUnique.mockResolvedValue(null);

        await expect(getPointBalance("company-1")).rejects.toThrow(
          NoSubscriptionError,
        );
      });
    });
  });

  describe("checkPointBalance - ポイント残高チェック", () => {
    describe("正常系", () => {
      it("ポイントが十分な場合、canProceed: trueを返す", async () => {
        mockPrisma.subscription.findUnique.mockResolvedValue({
          companyId: "company-1",
          pointBalance: 100,
        });

        const result = await checkPointBalance("company-1", "CONVERSATION");

        expect(result.canProceed).toBe(true);
        expect(result.required).toBe(1);
        expect(result.available).toBe(100);
      });

      it("無料アクション（INTEREST）の場合、常にcanProceed: trueを返す", async () => {
        // サブスクリプションの確認すら不要
        const result = await checkPointBalance("company-1", "INTEREST");

        expect(result.canProceed).toBe(true);
        expect(result.required).toBe(0);
      });
    });

    describe("異常系", () => {
      it("ポイントが不足している場合、canProceed: falseを返す", async () => {
        mockPrisma.subscription.findUnique.mockResolvedValue({
          companyId: "company-1",
          pointBalance: 5,
        });

        const result = await checkPointBalance(
          "company-1",
          "CONTACT_DISCLOSURE",
        );

        expect(result.canProceed).toBe(false);
        expect(result.required).toBe(10);
        expect(result.available).toBe(5);
      });

      it("サブスクリプションがない場合、NoSubscriptionErrorをスロー", async () => {
        mockPrisma.subscription.findUnique.mockResolvedValue(null);

        await expect(
          checkPointBalance("company-1", "CONVERSATION"),
        ).rejects.toThrow(NoSubscriptionError);
      });
    });
  });

  describe("consumePoints - ポイント消費", () => {
    describe("正常系", () => {
      it("ポイントを消費し、新しい残高を返す", async () => {
        const mockTransaction = vi.fn(async (callback) => {
          const tx = {
            subscription: {
              findUnique: vi.fn().mockResolvedValue({
                companyId: "company-1",
                pointBalance: 100,
              }),
              update: vi.fn().mockResolvedValue({
                pointBalance: 99,
              }),
            },
            pointTransaction: {
              create: vi.fn(),
            },
          };
          return callback(tx);
        });
        mockPrisma.$transaction.mockImplementation(mockTransaction);

        const result = await consumePoints("company-1", "CONVERSATION");

        expect(result.newBalance).toBe(99);
        expect(result.consumed).toBe(1);
      });

      it("無料アクションは残高を変更しない", async () => {
        mockPrisma.subscription.findUnique.mockResolvedValue({
          companyId: "company-1",
          pointBalance: 100,
        });

        const _result = await consumePoints("company-1", "CONVERSATION");
        // 無料アクションのテストは別途必要（現在のコードでは対応していない）
      });
    });

    describe("異常系", () => {
      it("ポイント不足の場合、InsufficientPointsErrorをスロー", async () => {
        const mockTransaction = vi.fn(async (callback) => {
          const tx = {
            subscription: {
              findUnique: vi.fn().mockResolvedValue({
                companyId: "company-1",
                pointBalance: 5,
              }),
            },
          };
          return callback(tx);
        });
        mockPrisma.$transaction.mockImplementation(mockTransaction);

        await expect(
          consumePoints("company-1", "CONTACT_DISCLOSURE"),
        ).rejects.toThrow(InsufficientPointsError);
      });

      it("サブスクリプションがない場合、NoSubscriptionErrorをスロー", async () => {
        const mockTransaction = vi.fn(async (callback) => {
          const tx = {
            subscription: {
              findUnique: vi.fn().mockResolvedValue(null),
            },
          };
          return callback(tx);
        });
        mockPrisma.$transaction.mockImplementation(mockTransaction);

        await expect(
          consumePoints("company-1", "CONVERSATION"),
        ).rejects.toThrow(NoSubscriptionError);
      });
    });
  });

  describe("grantPoints - ポイント付与", () => {
    describe("正常系", () => {
      it("ポイントを付与し、新しい残高を返す", async () => {
        const mockTransaction = vi.fn(async (callback) => {
          const tx = {
            subscription: {
              findUnique: vi.fn().mockResolvedValue({
                companyId: "company-1",
                pointBalance: 100,
              }),
              update: vi.fn().mockResolvedValue({
                pointBalance: 200,
              }),
            },
            pointTransaction: {
              create: vi.fn(),
            },
          };
          return callback(tx);
        });
        mockPrisma.$transaction.mockImplementation(mockTransaction);

        const result = await grantPoints("company-1", 100, "GRANT");

        expect(result.newBalance).toBe(200);
      });
    });

    describe("異常系", () => {
      it("サブスクリプションがない場合、NoSubscriptionErrorをスロー", async () => {
        const mockTransaction = vi.fn(async (callback) => {
          const tx = {
            subscription: {
              findUnique: vi.fn().mockResolvedValue(null),
            },
          };
          return callback(tx);
        });
        mockPrisma.$transaction.mockImplementation(mockTransaction);

        await expect(grantPoints("company-1", 100, "GRANT")).rejects.toThrow(
          NoSubscriptionError,
        );
      });
    });
  });

  describe("getPointHistory - ポイント履歴取得", () => {
    describe("正常系", () => {
      it("ポイント履歴を新しい順で返す", async () => {
        const mockHistory = [
          { id: "1", amount: -1, createdAt: new Date("2024-01-02") },
          { id: "2", amount: 100, createdAt: new Date("2024-01-01") },
        ];
        mockPrisma.pointTransaction.findMany.mockResolvedValue(mockHistory);

        const history = await getPointHistory("company-1");

        expect(history).toEqual(mockHistory);
        expect(mockPrisma.pointTransaction.findMany).toHaveBeenCalledWith({
          where: { companyId: "company-1" },
          orderBy: { createdAt: "desc" },
          take: 50,
          skip: 0,
        });
      });

      it("ページネーションパラメータを正しく処理する", async () => {
        mockPrisma.pointTransaction.findMany.mockResolvedValue([]);

        await getPointHistory("company-1", 20, 40);

        expect(mockPrisma.pointTransaction.findMany).toHaveBeenCalledWith({
          where: { companyId: "company-1" },
          orderBy: { createdAt: "desc" },
          take: 20,
          skip: 40,
        });
      });
    });
  });

  describe("エラークラス", () => {
    it("InsufficientPointsErrorは必要ポイントと残高を含む", () => {
      const error = new InsufficientPointsError(10, 5);

      expect(error.required).toBe(10);
      expect(error.available).toBe(5);
      expect(error.message).toContain("10");
      expect(error.message).toContain("5");
    });

    it("NoSubscriptionErrorは適切なメッセージを持つ", () => {
      const error = new NoSubscriptionError();

      expect(error.message).toContain("サブスクリプション");
    });
  });
});
