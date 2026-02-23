import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────

const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
vi.mock("@/lib/logger", () => ({ logger: mockLogger }));

const mockGetServerSession = vi.fn();
vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

const mockPrisma = {
  interest: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  directMessage: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  notification: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ── Constants ──────────────────────────────────────────────────────

const INTEREST_ID = "interest-001";
const USER_ID = "user-001";
const RECRUITER_ID = "rec-001";
const RECRUITER_ACCOUNT_ID = "acc-rec-001";

const routeContext = {
  params: Promise.resolve({ interestId: INTEREST_ID }),
};

// ── Helpers ────────────────────────────────────────────────────────

function userSession() {
  return {
    user: {
      accountId: "acc-user-001",
      accountType: "USER",
      userId: USER_ID,
      recruiterId: null,
    },
  };
}

function mockInterest(overrides = {}) {
  return {
    id: INTEREST_ID,
    userId: USER_ID,
    recruiterId: RECRUITER_ID,
    status: "CONTACT_DISCLOSED",
    recruiter: { accountId: RECRUITER_ACCOUNT_ID },
    user: { name: "テスト太郎" },
    ...overrides,
  };
}

function createGetRequest(): NextRequest {
  return new NextRequest(
    `http://localhost/api/applicant/inbox/${INTEREST_ID}/messages`,
    { method: "GET" },
  );
}

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/applicant/inbox/${INTEREST_ID}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

async function importRoute() {
  return import("@/app/api/applicant/inbox/[interestId]/messages/route");
}

// ── Tests ──────────────────────────────────────────────────────────

describe("GET /api/applicant/inbox/[interestId]/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("認証済み求職者がメッセージ一覧を取得できる", async () => {
    mockGetServerSession.mockResolvedValue(userSession());
    mockPrisma.interest.findFirst.mockResolvedValue(mockInterest());
    mockPrisma.directMessage.findMany.mockResolvedValue([
      {
        id: "msg-1",
        content: "こんにちは",
        senderType: "RECRUITER",
        createdAt: new Date("2025-01-01"),
        recruiter: { company: { name: "テスト株式会社" } },
        user: null,
      },
      {
        id: "msg-2",
        content: "返信します",
        senderType: "USER",
        createdAt: new Date("2025-01-02"),
        recruiter: null,
        user: { name: "テスト太郎" },
      },
    ]);

    const { GET } = await importRoute();
    const res = await GET(createGetRequest(), routeContext);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].recruiter).toEqual({
      companyName: "テスト株式会社",
    });
    expect(body.messages[1].user).toEqual({ name: "テスト太郎" });
  });

  it("自分宛て以外の興味表明は404を返す", async () => {
    mockGetServerSession.mockResolvedValue(userSession());
    mockPrisma.interest.findFirst.mockResolvedValue(null);

    const { GET } = await importRoute();
    const res = await GET(createGetRequest(), routeContext);
    expect(res.status).toBe(404);
  });

  it("未認証の場合は401を返す", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { GET } = await importRoute();
    const res = await GET(createGetRequest(), routeContext);
    expect(res.status).toBe(401);
  });

  it("findFirstでuserIdフィルタをかけている", async () => {
    mockGetServerSession.mockResolvedValue(userSession());
    mockPrisma.interest.findFirst.mockResolvedValue(mockInterest());
    mockPrisma.directMessage.findMany.mockResolvedValue([]);

    const { GET } = await importRoute();
    await GET(createGetRequest(), routeContext);

    expect(mockPrisma.interest.findFirst).toHaveBeenCalledWith({
      where: {
        id: INTEREST_ID,
        userId: USER_ID,
      },
    });
  });
});

describe("POST /api/applicant/inbox/[interestId]/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── バリデーション ──────────────────────────────────────────

  describe("バリデーション", () => {
    it("空のcontentで400を返す", async () => {
      mockGetServerSession.mockResolvedValue(userSession());
      mockPrisma.interest.findFirst.mockResolvedValue(mockInterest());

      const { POST } = await importRoute();
      const res = await POST(createPostRequest({ content: "" }), routeContext);
      expect(res.status).toBe(400);
    });

    it("5000文字超のcontentで400を返す", async () => {
      mockGetServerSession.mockResolvedValue(userSession());
      mockPrisma.interest.findFirst.mockResolvedValue(mockInterest());

      const { POST } = await importRoute();
      const res = await POST(
        createPostRequest({ content: "a".repeat(5001) }),
        routeContext,
      );
      expect(res.status).toBe(400);
    });

    it("contentが未指定で400を返す", async () => {
      mockGetServerSession.mockResolvedValue(userSession());
      mockPrisma.interest.findFirst.mockResolvedValue(mockInterest());

      const { POST } = await importRoute();
      const res = await POST(createPostRequest({}), routeContext);
      expect(res.status).toBe(400);
    });
  });

  // ── 認証・認可 ──────────────────────────────────────────────

  describe("認証・認可", () => {
    it("未認証の場合は401を返す", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const { POST } = await importRoute();
      const res = await POST(
        createPostRequest({ content: "hello" }),
        routeContext,
      );
      expect(res.status).toBe(401);
    });

    it("自分宛てでないまたはCONTACT_DISCLOSED以外で403を返す", async () => {
      mockGetServerSession.mockResolvedValue(userSession());
      mockPrisma.interest.findFirst.mockResolvedValue(null);

      const { POST } = await importRoute();
      const res = await POST(
        createPostRequest({ content: "hello" }),
        routeContext,
      );
      expect(res.status).toBe(403);
    });

    it("findFirstでuserIdとstatusフィルタをかけている", async () => {
      mockGetServerSession.mockResolvedValue(userSession());
      mockPrisma.interest.findFirst.mockResolvedValue(mockInterest());

      const mockTxClient = {
        interest: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        directMessage: {
          create: vi.fn().mockResolvedValue({
            id: "msg-new",
            content: "test",
            senderType: "USER",
            createdAt: new Date(),
            user: { name: "テスト太郎" },
          }),
        },
        notification: { create: vi.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation(
        async (callback: (tx: typeof mockTxClient) => Promise<unknown>) =>
          callback(mockTxClient),
      );

      const { POST } = await importRoute();
      await POST(createPostRequest({ content: "test" }), routeContext);

      expect(mockPrisma.interest.findFirst).toHaveBeenCalledWith({
        where: {
          id: INTEREST_ID,
          userId: USER_ID,
          status: "CONTACT_DISCLOSED",
        },
        include: {
          recruiter: { select: { accountId: true } },
          user: { select: { name: true } },
        },
      });
    });
  });

  // ── メッセージ送信 ──────────────────────────────────────────

  describe("メッセージ送信", () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue(userSession());
      mockPrisma.interest.findFirst.mockResolvedValue(mockInterest());
    });

    it("メッセージ送信成功で201を返す", async () => {
      const createdMsg = {
        id: "msg-new",
        content: "ありがとうございます",
        senderType: "USER",
        createdAt: new Date(),
        user: { name: "テスト太郎" },
      };

      const mockTxClient = {
        interest: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        directMessage: { create: vi.fn().mockResolvedValue(createdMsg) },
        notification: { create: vi.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation(
        async (callback: (tx: typeof mockTxClient) => Promise<unknown>) =>
          callback(mockTxClient),
      );

      const { POST } = await importRoute();
      const res = await POST(
        createPostRequest({ content: "ありがとうございます" }),
        routeContext,
      );
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.message.id).toBe("msg-new");
      expect(body.message.recruiter).toBeNull();
      expect(body.message.user).toEqual({ name: "テスト太郎" });
    });

    it("通知を採用担当者宛てに作成する", async () => {
      const mockTxClient = {
        interest: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        directMessage: {
          create: vi.fn().mockResolvedValue({
            id: "msg-new",
            content: "hello",
            senderType: "USER",
            createdAt: new Date(),
            user: { name: "テスト太郎" },
          }),
        },
        notification: { create: vi.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation(
        async (callback: (tx: typeof mockTxClient) => Promise<unknown>) =>
          callback(mockTxClient),
      );

      const { POST } = await importRoute();
      await POST(createPostRequest({ content: "hello" }), routeContext);

      expect(mockTxClient.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accountId: RECRUITER_ACCOUNT_ID,
          type: "SYSTEM",
          title: "新しいメッセージ",
          body: "テスト太郎からメッセージが届きました",
        }),
      });
    });

    it("contentの前後空白がトリムされる", async () => {
      const mockTxClient = {
        interest: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        directMessage: {
          create: vi.fn().mockResolvedValue({
            id: "msg-new",
            content: "trimmed",
            senderType: "USER",
            createdAt: new Date(),
            user: { name: "テスト太郎" },
          }),
        },
        notification: { create: vi.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation(
        async (callback: (tx: typeof mockTxClient) => Promise<unknown>) =>
          callback(mockTxClient),
      );

      const { POST } = await importRoute();
      await POST(createPostRequest({ content: "  trimmed  " }), routeContext);

      expect(mockTxClient.directMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ content: "trimmed" }),
        include: expect.any(Object),
      });
    });
  });

  // ── TOCTOU防止 ──────────────────────────────────────────────

  describe("TOCTOU防止（ステータス競合）", () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue(userSession());
      mockPrisma.interest.findFirst.mockResolvedValue(mockInterest());
    });

    it("トランザクション内でステータスが変更されていたら409を返す", async () => {
      const mockTxClient = {
        interest: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        directMessage: { create: vi.fn() },
        notification: { create: vi.fn() },
      };
      mockPrisma.$transaction.mockImplementation(
        async (callback: (tx: typeof mockTxClient) => Promise<unknown>) =>
          callback(mockTxClient),
      );

      const { POST } = await importRoute();
      const res = await POST(
        createPostRequest({ content: "hello" }),
        routeContext,
      );
      expect(res.status).toBe(409);

      const body = await res.json();
      expect(body.error).toContain("開示状態が変更");
    });

    it("ステータスチェック失敗後にメッセージが作成されない", async () => {
      let msgCreateCalled = false;
      const mockTxClient = {
        interest: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        directMessage: {
          create: vi.fn().mockImplementation(() => {
            msgCreateCalled = true;
            return { id: "msg-new" };
          }),
        },
        notification: { create: vi.fn() },
      };
      mockPrisma.$transaction.mockImplementation(
        async (callback: (tx: typeof mockTxClient) => Promise<unknown>) =>
          callback(mockTxClient),
      );

      const { POST } = await importRoute();
      await POST(createPostRequest({ content: "hello" }), routeContext);

      expect(msgCreateCalled).toBe(false);
    });

    it("updateManyにCONTACT_DISCLOSED条件が含まれている", async () => {
      const mockTxClient = {
        interest: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        directMessage: {
          create: vi.fn().mockResolvedValue({
            id: "msg-new",
            content: "test",
            senderType: "USER",
            createdAt: new Date(),
            user: { name: "テスト太郎" },
          }),
        },
        notification: { create: vi.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation(
        async (callback: (tx: typeof mockTxClient) => Promise<unknown>) =>
          callback(mockTxClient),
      );

      const { POST } = await importRoute();
      await POST(createPostRequest({ content: "test" }), routeContext);

      expect(mockTxClient.interest.updateMany).toHaveBeenCalledWith({
        where: { id: INTEREST_ID, status: "CONTACT_DISCLOSED" },
        data: { updatedAt: expect.any(Date) },
      });
    });
  });
});
