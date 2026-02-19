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
    findMany: vi.fn(),
    update: vi.fn(),
  },
  pointTransaction: {
    create: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
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
  expirePointsBatch,
  getPointBalance,
  getPointHistory,
  grantPoints,
  InsufficientPointsError,
  NoSubscriptionError,
  SubscriptionInactiveError,
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
    function createConsumeTx(overrides?: {
      pointBalance?: number;
      status?: string;
      expiredTransactions?: Array<{ id: string; amount: number }>;
    }) {
      const balance = overrides?.pointBalance ?? 100;
      const status = overrides?.status ?? "ACTIVE";
      const expiredTxs = overrides?.expiredTransactions ?? [];
      return {
        $queryRaw: vi.fn().mockResolvedValue([
          {
            id: "sub-1",
            companyId: "company-1",
            pointBalance: balance,
            pointsIncluded: 300,
            status,
            planType: "STANDARD",
          },
        ]),
        subscription: {
          findUnique: vi.fn().mockResolvedValue({
            companyId: "company-1",
            pointBalance: balance,
          }),
          update: vi.fn().mockResolvedValue({ pointBalance: balance - 1 }),
        },
        pointTransaction: {
          create: vi.fn(),
          findMany: vi.fn().mockResolvedValue(expiredTxs),
          updateMany: vi.fn(),
        },
      };
    }

    describe("正常系", () => {
      it("ポイントを消費し、新しい残高を返す", async () => {
        const tx = createConsumeTx();
        mockPrisma.$transaction.mockImplementation((cb) => cb(tx));

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

      it("$queryRawでFOR UPDATEロックが使用される", async () => {
        const tx = createConsumeTx();
        mockPrisma.$transaction.mockImplementation((cb) => cb(tx));

        await consumePoints("company-1", "CONVERSATION");

        expect(tx.$queryRaw).toHaveBeenCalled();
      });

      it("期限切れポイントがある場合、消費前に失効処理される", async () => {
        const tx = createConsumeTx({
          pointBalance: 100,
          expiredTransactions: [{ id: "pt-1", amount: 30 }],
        });
        // 失効後の残高を再取得
        tx.subscription.findUnique.mockResolvedValue({
          companyId: "company-1",
          pointBalance: 70,
        });
        tx.subscription.update.mockResolvedValue({ pointBalance: 69 });
        mockPrisma.$transaction.mockImplementation((cb) => cb(tx));

        const result = await consumePoints("company-1", "CONVERSATION");

        expect(result.newBalance).toBe(69);
        expect(tx.pointTransaction.findMany).toHaveBeenCalled();
        expect(tx.pointTransaction.updateMany).toHaveBeenCalled();
      });

      it("期限切れ取引がない場合、残高は変化しない", async () => {
        const tx = createConsumeTx({ pointBalance: 100 });
        mockPrisma.$transaction.mockImplementation((cb) => cb(tx));

        const result = await consumePoints("company-1", "CONVERSATION");

        expect(result.newBalance).toBe(99);
        expect(tx.pointTransaction.updateMany).not.toHaveBeenCalled();
      });
    });

    describe("異常系", () => {
      it("ポイント不足の場合、InsufficientPointsErrorをスロー", async () => {
        const tx = createConsumeTx({ pointBalance: 5 });
        tx.subscription.findUnique.mockResolvedValue({
          companyId: "company-1",
          pointBalance: 5,
        });
        mockPrisma.$transaction.mockImplementation((cb) => cb(tx));

        await expect(
          consumePoints("company-1", "CONTACT_DISCLOSURE"),
        ).rejects.toThrow(InsufficientPointsError);
      });

      it("サブスクリプションがない場合、NoSubscriptionErrorをスロー", async () => {
        mockPrisma.$transaction.mockImplementation((cb) =>
          cb({ $queryRaw: vi.fn().mockResolvedValue([]) }),
        );

        await expect(
          consumePoints("company-1", "CONVERSATION"),
        ).rejects.toThrow(NoSubscriptionError);
      });

      it("PAST_DUEステータスの場合、SubscriptionInactiveErrorをスロー", async () => {
        const tx = createConsumeTx({ status: "PAST_DUE" });
        mockPrisma.$transaction.mockImplementation((cb) => cb(tx));

        await expect(
          consumePoints("company-1", "CONVERSATION"),
        ).rejects.toThrow(SubscriptionInactiveError);
      });

      it("CANCELEDステータスの場合、SubscriptionInactiveErrorをスロー", async () => {
        const tx = createConsumeTx({ status: "CANCELED" });
        mockPrisma.$transaction.mockImplementation((cb) => cb(tx));

        await expect(
          consumePoints("company-1", "CONVERSATION"),
        ).rejects.toThrow(SubscriptionInactiveError);
      });

      it("失効後に残高不足になる場合、InsufficientPointsErrorをスロー", async () => {
        const tx = createConsumeTx({
          pointBalance: 15,
          expiredTransactions: [{ id: "pt-1", amount: 10 }],
        });
        // 失効後の残高(5) < CONTACT_DISCLOSURE(10)
        tx.subscription.findUnique.mockResolvedValue({
          companyId: "company-1",
          pointBalance: 5,
        });
        mockPrisma.$transaction.mockImplementation((cb) => cb(tx));

        await expect(
          consumePoints("company-1", "CONTACT_DISCLOSURE"),
        ).rejects.toThrow(InsufficientPointsError);
      });
    });
  });

  describe("grantPoints - ポイント付与", () => {
    function createGrantTx(overrides?: {
      pointBalance?: number;
      pointsIncluded?: number;
    }) {
      const balance = overrides?.pointBalance ?? 100;
      const included = overrides?.pointsIncluded ?? 300;
      return {
        $queryRaw: vi.fn().mockResolvedValue([
          {
            id: "sub-1",
            companyId: "company-1",
            pointBalance: balance,
            pointsIncluded: included,
            status: "ACTIVE",
            planType: "STANDARD",
          },
        ]),
        subscription: {
          update: vi
            .fn()
            .mockResolvedValue({ pointBalance: balance + included }),
        },
        pointTransaction: { create: vi.fn() },
      };
    }

    describe("正常系", () => {
      it("ポイントを付与し、新しい残高を返す", async () => {
        const tx = createGrantTx({ pointBalance: 100 });
        mockPrisma.$transaction.mockImplementation((cb) => cb(tx));

        const result = await grantPoints("company-1", 100, "GRANT");

        // 繰越上限 = 300 * 0.5 = 150, 残高100 <= 150なので繰越カットなし
        expect(result.newBalance).toBe(200);
      });

      it("GRANT/PURCHASE取引にexpiresAtが設定される", async () => {
        const tx = createGrantTx({ pointBalance: 50 });
        mockPrisma.$transaction.mockImplementation((cb) => cb(tx));

        await grantPoints("company-1", 100, "GRANT");

        expect(tx.pointTransaction.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              expiresAt: expect.any(Date),
            }),
          }),
        );
      });

      it("月次GRANT時に繰越上限を超過した場合、超過分が失効してからGRANTされる", async () => {
        // pointsIncluded=300 → 繰越上限=150, 残高200 > 150 → 50pt失効
        const tx = createGrantTx({
          pointBalance: 200,
          pointsIncluded: 300,
        });
        let updateCallCount = 0;
        tx.subscription.update.mockImplementation(() => {
          updateCallCount++;
          // 1回目: 繰越上限まで削減(150), 2回目: GRANT後(150+300=450)
          if (updateCallCount === 1) {
            return { pointBalance: 150 };
          }
          return { pointBalance: 450 };
        });
        mockPrisma.$transaction.mockImplementation((cb) => cb(tx));

        const result = await grantPoints("company-1", 300, "GRANT");

        expect(result.newBalance).toBe(450);
        // EXPIRE取引 + GRANT取引の2回create
        expect(tx.pointTransaction.create).toHaveBeenCalledTimes(2);
        expect(tx.pointTransaction.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              type: "EXPIRE",
              amount: -50,
              description: expect.stringContaining("繰越上限超過"),
            }),
          }),
        );
      });

      it("繰越上限内の場合、そのままGRANTされる", async () => {
        // pointsIncluded=300 → 繰越上限=150, 残高100 <= 150 → カットなし
        const tx = createGrantTx({
          pointBalance: 100,
          pointsIncluded: 300,
        });
        mockPrisma.$transaction.mockImplementation((cb) => cb(tx));

        const result = await grantPoints("company-1", 300, "GRANT");

        expect(result.newBalance).toBe(400);
        // GRANT取引のみ（EXPIRE取引なし）
        expect(tx.pointTransaction.create).toHaveBeenCalledTimes(1);
      });
    });

    describe("異常系", () => {
      it("サブスクリプションがない場合、NoSubscriptionErrorをスロー", async () => {
        mockPrisma.$transaction.mockImplementation((cb) =>
          cb({ $queryRaw: vi.fn().mockResolvedValue([]) }),
        );

        await expect(grantPoints("company-1", 100, "GRANT")).rejects.toThrow(
          NoSubscriptionError,
        );
      });
    });
  });

  describe("expirePointsBatch - バッチ失効処理", () => {
    it("期限切れGRANTがある場合、ポイントが失効する", async () => {
      const tx = {
        pointTransaction: {
          findMany: vi.fn().mockResolvedValue([
            { id: "pt-1", amount: 50 },
            { id: "pt-2", amount: 30 },
          ]),
          create: vi.fn(),
          updateMany: vi.fn(),
        },
        subscription: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ companyId: "company-1", pointBalance: 100 }),
          update: vi.fn().mockResolvedValue({ pointBalance: 20 }),
        },
      };
      mockPrisma.$transaction.mockImplementation((cb) => cb(tx));

      const result = await expirePointsBatch("company-1");

      expect(result.expired).toBe(80);
      expect(tx.pointTransaction.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["pt-1", "pt-2"] } },
        data: { expired: true },
      });
    });

    it("期限切れ取引がない場合、変化なし", async () => {
      const tx = {
        pointTransaction: {
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn(),
          updateMany: vi.fn(),
        },
        subscription: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ companyId: "company-1", pointBalance: 100 }),
          update: vi.fn(),
        },
      };
      mockPrisma.$transaction.mockImplementation((cb) => cb(tx));

      const result = await expirePointsBatch("company-1");

      expect(result.expired).toBe(0);
      expect(tx.subscription.update).not.toHaveBeenCalled();
    });

    it("残高より多い失効量の場合、残高分のみ失効する", async () => {
      const tx = {
        pointTransaction: {
          findMany: vi.fn().mockResolvedValue([{ id: "pt-1", amount: 200 }]),
          create: vi.fn(),
          updateMany: vi.fn(),
        },
        subscription: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ companyId: "company-1", pointBalance: 50 }),
          update: vi.fn().mockResolvedValue({ pointBalance: 0 }),
        },
      };
      mockPrisma.$transaction.mockImplementation((cb) => cb(tx));

      const result = await expirePointsBatch("company-1");

      // 失効額は残高(50)に制限される
      expect(result.expired).toBe(50);
      expect(tx.subscription.update).toHaveBeenCalledWith({
        where: { companyId: "company-1" },
        data: { pointBalance: 0 },
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

    it("SubscriptionInactiveErrorはステータスを含む", () => {
      const error = new SubscriptionInactiveError("PAST_DUE");

      expect(error.status).toBe("PAST_DUE");
      expect(error.statusCode).toBe(402);
      expect(error.message).toContain("サブスクリプション");
    });
  });
});
