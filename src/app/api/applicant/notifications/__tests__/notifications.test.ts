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
  notification: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ── Constants ──────────────────────────────────────────────────────

const USER_ID = "user-001";
const ACCOUNT_ID = "acc-001";

const userSession = {
  user: {
    userId: USER_ID,
    accountId: ACCOUNT_ID,
    accountType: "USER",
  },
};

const mockNotification = {
  id: "notif-001",
  accountId: ACCOUNT_ID,
  type: "INTEREST_RECEIVED",
  title: "興味表明を受信",
  body: "企業Aから興味表明がありました",
  isRead: false,
  createdAt: new Date("2024-01-15"),
  data: { interestId: "interest-123", companyName: "企業A" },
};

const mockReadNotification = {
  id: "notif-002",
  accountId: ACCOUNT_ID,
  type: "SYSTEM",
  title: "お知らせ",
  body: "システムメンテナンスのお知らせ",
  isRead: true,
  createdAt: new Date("2024-01-10"),
  data: null,
};

// ── Helpers ────────────────────────────────────────────────────────

function createGetRequest(queryString = ""): NextRequest {
  return new NextRequest(
    `http://localhost/api/applicant/notifications${queryString}`,
    { method: "GET" },
  );
}

function createPatchRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/applicant/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── GET Tests ──────────────────────────────────────────────────────

describe("GET /api/applicant/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(userSession);
  });

  it("通知一覧を返す", async () => {
    mockPrisma.notification.findMany.mockResolvedValue([
      mockNotification,
      mockReadNotification,
    ]);

    const { GET } = await import("@/app/api/applicant/notifications/route");
    const response = await GET(createGetRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.notifications).toHaveLength(2);
    expect(data.unreadCount).toBe(1);
  });

  it("通知データを正しい形式に整形する", async () => {
    mockPrisma.notification.findMany.mockResolvedValue([mockNotification]);

    const { GET } = await import("@/app/api/applicant/notifications/route");
    const response = await GET(createGetRequest());
    const data = await response.json();

    const notif = data.notifications[0];
    expect(notif.id).toBe("notif-001");
    expect(notif.type).toBe("INTEREST_RECEIVED");
    expect(notif.title).toBe("興味表明を受信");
    expect(notif.message).toBe("企業Aから興味表明がありました");
    expect(notif.isRead).toBe(false);
    expect(notif.relatedInterest).toEqual({
      id: "interest-123",
      companyName: "企業A",
    });
  });

  it("data.interestIdがない通知はrelatedInterestがnull", async () => {
    mockPrisma.notification.findMany.mockResolvedValue([mockReadNotification]);

    const { GET } = await import("@/app/api/applicant/notifications/route");
    const response = await GET(createGetRequest());
    const data = await response.json();

    expect(data.notifications[0].relatedInterest).toBeNull();
  });

  it("unreadOnlyパラメータでフィルタする", async () => {
    mockPrisma.notification.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/applicant/notifications/route");
    await GET(createGetRequest("?unreadOnly=true"));

    expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          accountId: ACCOUNT_ID,
          isRead: false,
        }),
      }),
    );
  });

  it("unreadOnly未指定時はフィルタなし", async () => {
    mockPrisma.notification.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/applicant/notifications/route");
    await GET(createGetRequest());

    const callArgs = mockPrisma.notification.findMany.mock.calls[0][0];
    expect(callArgs.where.isRead).toBeUndefined();
  });

  it("未読→既読の順、作成日の降順でソートする", async () => {
    mockPrisma.notification.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/applicant/notifications/route");
    await GET(createGetRequest());

    expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
        take: 50,
      }),
    );
  });

  it("空の通知リストを返す", async () => {
    mockPrisma.notification.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/applicant/notifications/route");
    const response = await GET(createGetRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.notifications).toEqual([]);
    expect(data.unreadCount).toBe(0);
  });

  it("未認証の場合401を返す", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { GET } = await import("@/app/api/applicant/notifications/route");
    const response = await GET(createGetRequest());

    expect(response.status).toBe(401);
  });

  it("userIdがない場合403を返す", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { accountId: ACCOUNT_ID, accountType: "RECRUITER" },
    });

    const { GET } = await import("@/app/api/applicant/notifications/route");
    const response = await GET(createGetRequest());

    expect(response.status).toBe(403);
  });
});

// ── PATCH Tests ────────────────────────────────────────────────────

describe("PATCH /api/applicant/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(userSession);
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 1 });
  });

  it("markAllAsReadで全通知を既読にする", async () => {
    const { PATCH } = await import("@/app/api/applicant/notifications/route");
    const response = await PATCH(createPatchRequest({ markAllAsRead: true }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        accountId: ACCOUNT_ID,
        isRead: false,
      },
      data: { isRead: true },
    });
  });

  it("notificationIdsで個別の通知を既読にする", async () => {
    const { PATCH } = await import("@/app/api/applicant/notifications/route");
    const response = await PATCH(
      createPatchRequest({ notificationIds: ["notif-001", "notif-002"] }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["notif-001", "notif-002"] },
        accountId: ACCOUNT_ID,
      },
      data: { isRead: true },
    });
  });

  it("interest-プレフィックスのIDをフィルタする", async () => {
    const { PATCH } = await import("@/app/api/applicant/notifications/route");
    await PATCH(
      createPatchRequest({
        notificationIds: [
          "notif-001",
          "interest-abc",
          "interest-def",
          "notif-002",
        ],
      }),
    );

    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["notif-001", "notif-002"] },
        accountId: ACCOUNT_ID,
      },
      data: { isRead: true },
    });
  });

  it("全てinterest-プレフィックスの場合はupdateManyを呼ばない", async () => {
    const { PATCH } = await import("@/app/api/applicant/notifications/route");
    const response = await PATCH(
      createPatchRequest({
        notificationIds: ["interest-abc", "interest-def"],
      }),
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.notification.updateMany).not.toHaveBeenCalled();
  });

  it("accountIdでスコープする（他ユーザーの通知を更新しない）", async () => {
    const { PATCH } = await import("@/app/api/applicant/notifications/route");
    await PATCH(createPatchRequest({ notificationIds: ["notif-001"] }));

    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          accountId: ACCOUNT_ID,
        }),
      }),
    );
  });

  it("空のリクエストボディでも200を返す", async () => {
    const { PATCH } = await import("@/app/api/applicant/notifications/route");
    const response = await PATCH(createPatchRequest({}));

    expect(response.status).toBe(200);
    expect(mockPrisma.notification.updateMany).not.toHaveBeenCalled();
  });

  it("未認証の場合401を返す", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/applicant/notifications/route");
    const response = await PATCH(createPatchRequest({ markAllAsRead: true }));

    expect(response.status).toBe(401);
  });

  it("userIdがない場合403を返す", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { accountId: ACCOUNT_ID, accountType: "RECRUITER" },
    });

    const { PATCH } = await import("@/app/api/applicant/notifications/route");
    const response = await PATCH(createPatchRequest({ markAllAsRead: true }));

    expect(response.status).toBe(403);
  });
});
