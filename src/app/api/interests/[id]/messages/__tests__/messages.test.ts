import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────

// Logger
const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
vi.mock("@/lib/logger", () => ({ logger: mockLogger }));

// NextAuth
const mockGetServerSession = vi.fn();
vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

// Points
const mockConsumePointsWithOperations = vi.fn();
vi.mock("@/lib/points", () => ({
  consumePointsWithOperations: (...args: unknown[]) =>
    mockConsumePointsWithOperations(...args),
}));

// Prisma
const mockPrisma = {
  interest: {
    findUnique: vi.fn(),
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
const RECRUITER_ID = "rec-001";
const USER_ID = "user-001";
const COMPANY_ID = "company-001";
const RECRUITER_ACCOUNT_ID = "acc-rec-001";
const USER_ACCOUNT_ID = "acc-user-001";

const routeContext = {
  params: Promise.resolve({ id: INTEREST_ID }),
};

// ── Helpers ────────────────────────────────────────────────────────

function recruiterSession() {
  return {
    user: {
      accountId: RECRUITER_ACCOUNT_ID,
      accountType: "RECRUITER",
      recruiterId: RECRUITER_ID,
      companyId: COMPANY_ID,
      userId: null,
    },
  };
}

function userSession() {
  return {
    user: {
      accountId: USER_ACCOUNT_ID,
      accountType: "USER",
      userId: USER_ID,
      recruiterId: null,
      companyId: null,
    },
  };
}

function mockInterest(overrides = {}) {
  return {
    id: INTEREST_ID,
    recruiterId: RECRUITER_ID,
    userId: USER_ID,
    status: "CONTACT_DISCLOSED",
    user: {
      id: USER_ID,
      name: "テスト太郎",
      accountId: USER_ACCOUNT_ID,
    },
    recruiter: {
      id: RECRUITER_ID,
      companyId: COMPANY_ID,
      accountId: RECRUITER_ACCOUNT_ID,
      company: { name: "テスト株式会社" },
    },
    ...overrides,
  };
}

function createGetRequest(): NextRequest {
  return new NextRequest(
    `http://localhost/api/interests/${INTEREST_ID}/messages`,
    { method: "GET" },
  );
}

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/interests/${INTEREST_ID}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

async function importRoute() {
  return import("@/app/api/interests/[id]/messages/route");
}

// ── Tests ──────────────────────────────────────────────────────────

describe("GET /api/interests/[id]/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("認証済みリクルーターがメッセージ一覧を取得できる", async () => {
    mockGetServerSession.mockResolvedValue(recruiterSession());
    mockPrisma.interest.findUnique.mockResolvedValue({
      id: INTEREST_ID,
      recruiterId: RECRUITER_ID,
      userId: USER_ID,
    });
    mockPrisma.directMessage.findMany.mockResolvedValue([
      {
        id: "msg-1",
        content: "こんにちは",
        senderType: "RECRUITER",
        createdAt: new Date("2025-01-01"),
        recruiter: { id: RECRUITER_ID, company: { name: "テスト株式会社" } },
        user: null,
      },
    ]);

    const { GET } = await importRoute();
    const res = await GET(createGetRequest(), routeContext);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].recruiter.companyName).toBe("テスト株式会社");
  });

  it("認証済み求職者がメッセージ一覧を取得できる", async () => {
    mockGetServerSession.mockResolvedValue(userSession());
    mockPrisma.interest.findUnique.mockResolvedValue({
      id: INTEREST_ID,
      recruiterId: RECRUITER_ID,
      userId: USER_ID,
    });
    mockPrisma.directMessage.findMany.mockResolvedValue([]);

    const { GET } = await importRoute();
    const res = await GET(createGetRequest(), routeContext);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.messages).toHaveLength(0);
  });

  it("興味表明が見つからない場合は404を返す", async () => {
    mockGetServerSession.mockResolvedValue(recruiterSession());
    mockPrisma.interest.findUnique.mockResolvedValue(null);

    const { GET } = await importRoute();
    const res = await GET(createGetRequest(), routeContext);
    expect(res.status).toBe(404);
  });

  it("関係のないユーザーは403を返す", async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        accountId: "acc-other",
        accountType: "USER",
        userId: "other-user",
        recruiterId: null,
      },
    });
    mockPrisma.interest.findUnique.mockResolvedValue({
      id: INTEREST_ID,
      recruiterId: RECRUITER_ID,
      userId: USER_ID,
    });

    const { GET } = await importRoute();
    const res = await GET(createGetRequest(), routeContext);
    expect(res.status).toBe(403);
  });

  it("未認証の場合は401を返す", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { GET } = await importRoute();
    const res = await GET(createGetRequest(), routeContext);
    expect(res.status).toBe(401);
  });

  it("recruiterがnullのメッセージはrecruiter: nullとして返す", async () => {
    mockGetServerSession.mockResolvedValue(userSession());
    mockPrisma.interest.findUnique.mockResolvedValue({
      id: INTEREST_ID,
      recruiterId: RECRUITER_ID,
      userId: USER_ID,
    });
    mockPrisma.directMessage.findMany.mockResolvedValue([
      {
        id: "msg-1",
        content: "返信です",
        senderType: "USER",
        createdAt: new Date("2025-01-01"),
        recruiter: null,
        user: { id: USER_ID, name: "テスト太郎" },
      },
    ]);

    const { GET } = await importRoute();
    const res = await GET(createGetRequest(), routeContext);
    const body = await res.json();
    expect(body.messages[0].recruiter).toBeNull();
  });
});

describe("POST /api/interests/[id]/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── バリデーション ──────────────────────────────────────────

  describe("バリデーション", () => {
    it("空のcontentで400を返す", async () => {
      mockGetServerSession.mockResolvedValue(recruiterSession());
      mockPrisma.interest.findUnique.mockResolvedValue(mockInterest());

      const { POST } = await importRoute();
      const res = await POST(createPostRequest({ content: "" }), routeContext);
      expect(res.status).toBe(400);
    });

    it("5000文字超のcontentで400を返す", async () => {
      mockGetServerSession.mockResolvedValue(recruiterSession());
      mockPrisma.interest.findUnique.mockResolvedValue(mockInterest());

      const { POST } = await importRoute();
      const res = await POST(
        createPostRequest({ content: "a".repeat(5001) }),
        routeContext,
      );
      expect(res.status).toBe(400);
    });

    it("contentが未指定で400を返す", async () => {
      mockGetServerSession.mockResolvedValue(recruiterSession());
      mockPrisma.interest.findUnique.mockResolvedValue(mockInterest());

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

    it("興味表明が見つからない場合は404を返す", async () => {
      mockGetServerSession.mockResolvedValue(recruiterSession());
      mockPrisma.interest.findUnique.mockResolvedValue(null);

      const { POST } = await importRoute();
      const res = await POST(
        createPostRequest({ content: "hello" }),
        routeContext,
      );
      expect(res.status).toBe(404);
    });

    it("CONTACT_DISCLOSED以外のステータスで403を返す", async () => {
      mockGetServerSession.mockResolvedValue(recruiterSession());
      mockPrisma.interest.findUnique.mockResolvedValue(
        mockInterest({ status: "EXPRESSED" }),
      );

      const { POST } = await importRoute();
      const res = await POST(
        createPostRequest({ content: "hello" }),
        routeContext,
      );
      expect(res.status).toBe(403);
    });

    it("関係のないユーザーは403を返す", async () => {
      mockGetServerSession.mockResolvedValue({
        user: {
          accountId: "acc-other",
          accountType: "USER",
          userId: "other-user",
          recruiterId: null,
        },
      });
      mockPrisma.interest.findUnique.mockResolvedValue(mockInterest());

      const { POST } = await importRoute();
      const res = await POST(
        createPostRequest({ content: "hello" }),
        routeContext,
      );
      expect(res.status).toBe(403);
    });
  });

  // ── リクルーターのメッセージ送信 ──────────────────────────

  describe("リクルーター送信", () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue(recruiterSession());
      mockPrisma.interest.findUnique.mockResolvedValue(mockInterest());
    });

    it("メッセージ送信成功で201を返す", async () => {
      const createdMsg = {
        id: "msg-new",
        interestId: INTEREST_ID,
        senderId: RECRUITER_ID,
        senderType: "RECRUITER",
        content: "面接のご案内",
        createdAt: new Date(),
      };
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
            directMessage: { create: vi.fn().mockResolvedValue(createdMsg) },
            notification: { create: vi.fn().mockResolvedValue({}) },
          };
          const result = await operations(mockTx);
          return { newBalance: 47, consumed: 3, result };
        },
      );

      const { POST } = await importRoute();
      const res = await POST(
        createPostRequest({ content: "面接のご案内" }),
        routeContext,
      );
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.message.id).toBe("msg-new");
    });

    it("consumePointsWithOperationsに正しいパラメータを渡す", async () => {
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
            directMessage: {
              create: vi.fn().mockResolvedValue({ id: "msg-new" }),
            },
            notification: { create: vi.fn().mockResolvedValue({}) },
          };
          const result = await operations(mockTx);
          return { newBalance: 47, consumed: 3, result };
        },
      );

      const { POST } = await importRoute();
      await POST(createPostRequest({ content: "test" }), routeContext);

      expect(mockConsumePointsWithOperations).toHaveBeenCalledWith(
        COMPANY_ID,
        "MESSAGE_SEND",
        expect.any(Function),
        INTEREST_ID,
        `メッセージ送信: テスト太郎`,
      );
    });

    it("トランザクション内で通知を作成する", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let capturedTx: any;
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
            directMessage: {
              create: vi.fn().mockResolvedValue({ id: "msg-new" }),
            },
            notification: { create: vi.fn().mockResolvedValue({}) },
          };
          capturedTx = mockTx;
          const result = await operations(mockTx);
          return { newBalance: 47, consumed: 3, result };
        },
      );

      const { POST } = await importRoute();
      await POST(createPostRequest({ content: "hello" }), routeContext);

      expect(capturedTx!.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accountId: USER_ACCOUNT_ID,
          type: "SYSTEM",
          title: "新しいメッセージ",
          body: "テスト株式会社からメッセージが届きました",
        }),
      });
    });

    it("contentの前後の空白がトリムされる", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let capturedTx: any;
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
            directMessage: {
              create: vi.fn().mockResolvedValue({ id: "msg-new" }),
            },
            notification: { create: vi.fn().mockResolvedValue({}) },
          };
          capturedTx = mockTx;
          const result = await operations(mockTx);
          return { newBalance: 47, consumed: 3, result };
        },
      );

      const { POST } = await importRoute();
      await POST(createPostRequest({ content: "  trimmed  " }), routeContext);

      expect(capturedTx!.directMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          content: "trimmed",
        }),
      });
    });
  });

  // ── 求職者のメッセージ送信 ──────────────────────────────────

  describe("求職者送信", () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue(userSession());
      mockPrisma.interest.findUnique.mockResolvedValue(mockInterest());
    });

    it("メッセージ送信成功で201を返す（ポイント消費なし）", async () => {
      const createdMsg = {
        id: "msg-user",
        interestId: INTEREST_ID,
        senderId: USER_ID,
        senderType: "USER",
        content: "ありがとうございます",
        createdAt: new Date(),
      };

      const mockTxClient = {
        interest: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        directMessage: { create: vi.fn().mockResolvedValue(createdMsg) },
        notification: { create: vi.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation(
        async (callback: (tx: typeof mockTxClient) => Promise<unknown>) => {
          return callback(mockTxClient);
        },
      );

      const { POST } = await importRoute();
      const res = await POST(
        createPostRequest({ content: "ありがとうございます" }),
        routeContext,
      );
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.message.id).toBe("msg-user");

      // consumePointsWithOperationsは呼ばれない
      expect(mockConsumePointsWithOperations).not.toHaveBeenCalled();
    });

    it("トランザクション内で通知を作成する（相手はリクルーター）", async () => {
      const mockTxClient = {
        interest: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        directMessage: {
          create: vi.fn().mockResolvedValue({ id: "msg-user" }),
        },
        notification: { create: vi.fn().mockResolvedValue({}) },
      };
      mockPrisma.$transaction.mockImplementation(
        async (callback: (tx: typeof mockTxClient) => Promise<unknown>) => {
          return callback(mockTxClient);
        },
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
  });

  // ── TOCTOU防止 ──────────────────────────────────────────────

  describe("TOCTOU防止（ステータス競合）", () => {
    it("リクルーターパス: トランザクション内でステータスが変更されていたら409を返す", async () => {
      mockGetServerSession.mockResolvedValue(recruiterSession());
      mockPrisma.interest.findUnique.mockResolvedValue(mockInterest());

      // consumePointsWithOperations内のtx.interest.updateManyが0件を返す
      // （ステータスがCONTACT_DISCLOSEDではなくなっている）
      mockConsumePointsWithOperations.mockImplementation(
        async (
          _companyId: string,
          _action: string,
          operations: (tx: unknown) => Promise<unknown>,
        ) => {
          const mockTx = {
            interest: {
              updateMany: vi.fn().mockResolvedValue({ count: 0 }),
            },
            directMessage: { create: vi.fn() },
            notification: { create: vi.fn() },
          };
          const result = await operations(mockTx);
          return { newBalance: 47, consumed: 3, result };
        },
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

    it("求職者パス: トランザクション内でステータスが変更されていたら409を返す", async () => {
      mockGetServerSession.mockResolvedValue(userSession());
      mockPrisma.interest.findUnique.mockResolvedValue(mockInterest());

      const mockTxClient = {
        interest: {
          // ステータスが変更されていて0件マッチ
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        directMessage: { create: vi.fn() },
        notification: { create: vi.fn() },
      };
      mockPrisma.$transaction.mockImplementation(
        async (callback: (tx: typeof mockTxClient) => Promise<unknown>) => {
          return callback(mockTxClient);
        },
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

    it("リクルーターパス: ステータスチェック後にメッセージが作成されないことを確認", async () => {
      mockGetServerSession.mockResolvedValue(recruiterSession());
      mockPrisma.interest.findUnique.mockResolvedValue(mockInterest());

      let msgCreateCalled = false;
      mockConsumePointsWithOperations.mockImplementation(
        async (
          _companyId: string,
          _action: string,
          operations: (tx: unknown) => Promise<unknown>,
        ) => {
          const mockTx = {
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
          const result = await operations(mockTx);
          return { newBalance: 47, consumed: 3, result };
        },
      );

      const { POST } = await importRoute();
      await POST(createPostRequest({ content: "hello" }), routeContext);

      // ステータスチェック失敗後、directMessage.createは呼ばれない
      expect(msgCreateCalled).toBe(false);
    });

    it("求職者パス: ステータスチェック後にメッセージが作成されないことを確認", async () => {
      mockGetServerSession.mockResolvedValue(userSession());
      mockPrisma.interest.findUnique.mockResolvedValue(mockInterest());

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
        async (callback: (tx: typeof mockTxClient) => Promise<unknown>) => {
          return callback(mockTxClient);
        },
      );

      const { POST } = await importRoute();
      await POST(createPostRequest({ content: "hello" }), routeContext);

      expect(msgCreateCalled).toBe(false);
    });
  });
});
