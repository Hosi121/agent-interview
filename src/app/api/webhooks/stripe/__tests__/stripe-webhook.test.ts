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

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/stripe", () => ({ stripe: mockStripe }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

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
  });

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

  it("invoice.payment_failed → PAST_DUEに設定", async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: "invoice.payment_failed",
      data: {
        object: { subscription: "sub_123" },
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
  });

  it("invoice.paid → ACTIVEに復帰", async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: "invoice.paid",
      data: {
        object: { subscription: "sub_123" },
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

  it("customer.subscription.deleted → CANCELEDに設定", async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
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

  it("不明なイベント → 200 (received: true)", async () => {
    mockStripe.webhooks.constructEvent.mockReturnValue({
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
