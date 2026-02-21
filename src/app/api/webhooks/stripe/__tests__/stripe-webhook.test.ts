import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  subscription: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));

const mockStripe = vi.hoisted(() => ({
  webhooks: {
    constructEvent: vi.fn(),
  },
}));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/stripe", () => ({ stripe: mockStripe }));
vi.mock("@/lib/logger", () => ({ logger: mockLogger }));

import { POST } from "../route";

function createRequest(body: string, signature: string | null) {
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body,
    headers: signature ? { "stripe-signature": signature } : {},
  });
}

describe("Stripe Webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  });

  describe("署名検証", () => {
    it("署名なしの場合、400を返す", async () => {
      const req = createRequest("{}", null);
      const res = await POST(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Missing signature");
    });

    it("無効な署名の場合、400を返す", async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      const req = createRequest("{}", "invalid-sig");
      const res = await POST(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid signature");
    });

    it("STRIPE_WEBHOOK_SECRETが未設定の場合、500を返す", async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;

      const req = createRequest("{}", "valid-sig");
      const res = await POST(req);

      expect(res.status).toBe(500);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "STRIPE_WEBHOOK_SECRET is not configured",
        expect.any(Error),
      );
    });
  });

  describe("invoice.payment_failed", () => {
    it("PAST_DUEに設定する", async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        id: "evt_001",
        type: "invoice.payment_failed",
        data: {
          object: {
            parent: {
              subscription_details: { subscription: "sub_123" },
            },
          },
        },
      });
      mockPrisma.subscription.findFirst.mockResolvedValue({
        id: "local-sub-1",
        stripeSubscriptionId: "sub_123",
        status: "ACTIVE",
      });
      mockPrisma.subscription.update.mockResolvedValue({
        id: "local-sub-1",
        status: "PAST_DUE",
      });

      const req = createRequest("{}", "valid-sig");
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: "local-sub-1" },
        data: { status: "PAST_DUE" },
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Subscription marked as PAST_DUE",
        expect.objectContaining({
          stripeSubscriptionId: "sub_123",
          eventId: "evt_001",
        }),
      );
    });

    it("subscriptionIDが取得できない場合は警告ログを出す", async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        id: "evt_002",
        type: "invoice.payment_failed",
        data: {
          object: { parent: null },
        },
      });

      const req = createRequest("{}", "valid-sig");
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(mockPrisma.subscription.findFirst).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Stripe webhook: no subscription ID in invoice",
        expect.objectContaining({
          eventId: "evt_002",
          eventType: "invoice.payment_failed",
        }),
      );
    });
  });

  describe("invoice.paid", () => {
    it("ACTIVEに復帰する", async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        id: "evt_003",
        type: "invoice.paid",
        data: {
          object: {
            parent: {
              subscription_details: { subscription: "sub_123" },
            },
          },
        },
      });
      mockPrisma.subscription.findFirst.mockResolvedValue({
        id: "local-sub-1",
        stripeSubscriptionId: "sub_123",
        status: "PAST_DUE",
      });
      mockPrisma.subscription.update.mockResolvedValue({
        id: "local-sub-1",
        status: "ACTIVE",
      });

      const req = createRequest("{}", "valid-sig");
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: "local-sub-1" },
        data: { status: "ACTIVE" },
      });
    });

    it("subscriptionIDが取得できない場合は警告ログを出す", async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        id: "evt_004",
        type: "invoice.paid",
        data: {
          object: { parent: { subscription_details: {} } },
        },
      });

      const req = createRequest("{}", "valid-sig");
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(mockPrisma.subscription.findFirst).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Stripe webhook: no subscription ID in invoice",
        expect.objectContaining({ eventType: "invoice.paid" }),
      );
    });
  });

  describe("customer.subscription.deleted", () => {
    it("CANCELEDに設定する", async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        id: "evt_005",
        type: "customer.subscription.deleted",
        data: {
          object: { id: "sub_123" },
        },
      });
      mockPrisma.subscription.findFirst.mockResolvedValue({
        id: "local-sub-1",
        stripeSubscriptionId: "sub_123",
        status: "ACTIVE",
      });
      mockPrisma.subscription.update.mockResolvedValue({
        id: "local-sub-1",
        status: "CANCELED",
      });

      const req = createRequest("{}", "valid-sig");
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: "local-sub-1" },
        data: { status: "CANCELED" },
      });
    });
  });

  describe("不明なイベント", () => {
    it("200 (received: true) を返す", async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        id: "evt_006",
        type: "unknown.event",
        data: { object: {} },
      });

      const req = createRequest("{}", "valid-sig");
      const res = await POST(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.received).toBe(true);
      expect(mockPrisma.subscription.findFirst).not.toHaveBeenCalled();
    });
  });

  describe("エラーハンドリング", () => {
    it("DB障害時は500を返してStripeにリトライさせる", async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        id: "evt_007",
        type: "invoice.paid",
        data: {
          object: {
            parent: {
              subscription_details: { subscription: "sub_123" },
            },
          },
        },
      });
      mockPrisma.subscription.findFirst.mockRejectedValue(
        new Error("DB connection failed"),
      );

      const req = createRequest("{}", "valid-sig");
      const res = await POST(req);

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe("Webhook processing failed");
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Stripe webhook event processing failed",
        expect.any(Error),
        expect.objectContaining({
          eventId: "evt_007",
          eventType: "invoice.paid",
        }),
      );
    });

    it("subscription.update障害時も500を返す", async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        id: "evt_008",
        type: "customer.subscription.deleted",
        data: {
          object: { id: "sub_123" },
        },
      });
      mockPrisma.subscription.findFirst.mockResolvedValue({
        id: "local-sub-1",
        stripeSubscriptionId: "sub_123",
      });
      mockPrisma.subscription.update.mockRejectedValue(
        new Error("Update failed"),
      );

      const req = createRequest("{}", "valid-sig");
      const res = await POST(req);

      expect(res.status).toBe(500);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Stripe webhook event processing failed",
        expect.any(Error),
        expect.objectContaining({
          eventId: "evt_008",
          eventType: "customer.subscription.deleted",
        }),
      );
    });

    it("サブスクリプションが見つからない場合は警告ログを出して200を返す", async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        id: "evt_009",
        type: "invoice.paid",
        data: {
          object: {
            parent: {
              subscription_details: { subscription: "sub_unknown" },
            },
          },
        },
      });
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      const req = createRequest("{}", "valid-sig");
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Stripe webhook: subscription not found",
        expect.objectContaining({ stripeSubscriptionId: "sub_unknown" }),
      );
    });

    it("subscription objectのidがオブジェクトの場合も処理できる", async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        id: "evt_010",
        type: "invoice.paid",
        data: {
          object: {
            parent: {
              subscription_details: {
                subscription: { id: "sub_from_obj" },
              },
            },
          },
        },
      });
      mockPrisma.subscription.findFirst.mockResolvedValue({
        id: "local-sub-1",
        stripeSubscriptionId: "sub_from_obj",
      });
      mockPrisma.subscription.update.mockResolvedValue({
        id: "local-sub-1",
        status: "ACTIVE",
      });

      const req = createRequest("{}", "valid-sig");
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: "local-sub-1" },
        data: { status: "ACTIVE" },
      });
    });
  });
});
