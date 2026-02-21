import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────

const mockPrisma = {
  emailVerificationToken: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  account: {
    update: vi.fn(),
  },
  $transaction: vi.fn(),
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockSendVerificationEmail = vi.fn();
vi.mock("@/lib/email", () => ({
  sendVerificationEmail: (...args: unknown[]) =>
    mockSendVerificationEmail(...args),
}));

// ── Helpers ────────────────────────────────────────────────────────

const ACCOUNT_ID = "acc-001";
const EMAIL = "test@example.com";

function mockTokenRecord(overrides = {}) {
  return {
    id: "token-rec-001",
    token: "abc123hex",
    accountId: ACCOUNT_ID,
    usedAt: null,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24時間後
    createdAt: new Date(),
    account: { id: ACCOUNT_ID, emailVerified: false },
    ...overrides,
  };
}

async function importModule() {
  return import("@/lib/verification");
}

// ── Tests ──────────────────────────────────────────────────────────

describe("verifyEmailToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("有効なトークンでメール認証が成功する", async () => {
    const record = mockTokenRecord();
    mockPrisma.emailVerificationToken.findUnique.mockResolvedValue(record);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockTxClient: any = {
      emailVerificationToken: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      account: {
        update: vi.fn().mockResolvedValue({}),
      },
    };
    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mockTxClient) => Promise<unknown>) =>
        callback(mockTxClient),
    );

    const { verifyEmailToken } = await importModule();
    const result = await verifyEmailToken("abc123hex");

    expect(result).toEqual({ success: true });
  });

  it("トランザクション内でusedAt: null条件付きupdateManyを実行する（TOCTOU防止）", async () => {
    const record = mockTokenRecord();
    mockPrisma.emailVerificationToken.findUnique.mockResolvedValue(record);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockTxClient: any = {
      emailVerificationToken: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      account: {
        update: vi.fn().mockResolvedValue({}),
      },
    };
    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mockTxClient) => Promise<unknown>) =>
        callback(mockTxClient),
    );

    const { verifyEmailToken } = await importModule();
    await verifyEmailToken("abc123hex");

    // usedAt: null 条件で原子的更新
    expect(mockTxClient.emailVerificationToken.updateMany).toHaveBeenCalledWith(
      {
        where: { id: record.id, usedAt: null },
        data: { usedAt: expect.any(Date) },
      },
    );

    // アカウントのemailVerified更新
    expect(mockTxClient.account.update).toHaveBeenCalledWith({
      where: { id: ACCOUNT_ID },
      data: { emailVerified: true },
    });
  });

  it("同時リクエストで既にusedAtが設定された場合はエラーを返す（TOCTOU防止）", async () => {
    const record = mockTokenRecord();
    mockPrisma.emailVerificationToken.findUnique.mockResolvedValue(record);

    // updateMany が count: 0 を返す = 別のリクエストが先に使用済みにした
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockTxClient: any = {
      emailVerificationToken: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      account: {
        update: vi.fn(),
      },
    };
    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mockTxClient) => Promise<unknown>) =>
        callback(mockTxClient),
    );

    const { verifyEmailToken } = await importModule();
    await expect(verifyEmailToken("abc123hex")).rejects.toThrow(
      "この認証リンクは既に使用されています",
    );

    // アカウント更新は実行されない
    expect(mockTxClient.account.update).not.toHaveBeenCalled();
  });

  it("存在しないトークンでエラーを返す", async () => {
    mockPrisma.emailVerificationToken.findUnique.mockResolvedValue(null);

    const { verifyEmailToken } = await importModule();
    await expect(verifyEmailToken("invalid")).rejects.toThrow(
      "無効な認証リンクです",
    );

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("既に使用済みのトークンでエラーを返す", async () => {
    const record = mockTokenRecord({ usedAt: new Date() });
    mockPrisma.emailVerificationToken.findUnique.mockResolvedValue(record);

    const { verifyEmailToken } = await importModule();
    await expect(verifyEmailToken("abc123hex")).rejects.toThrow(
      "この認証リンクは既に使用されています",
    );

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("有効期限切れのトークンでエラーを返す", async () => {
    const record = mockTokenRecord({
      expiresAt: new Date(Date.now() - 1000), // 1秒前に期限切れ
    });
    mockPrisma.emailVerificationToken.findUnique.mockResolvedValue(record);

    const { verifyEmailToken } = await importModule();
    await expect(verifyEmailToken("abc123hex")).rejects.toThrow(
      "認証リンクの有効期限が切れています",
    );

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("createAndSendVerificationToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("トークンを作成してメールを送信する", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockTxClient: any = {
      emailVerificationToken: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
    };
    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mockTxClient) => Promise<unknown>) =>
        callback(mockTxClient),
    );
    mockSendVerificationEmail.mockResolvedValue(undefined);

    const { createAndSendVerificationToken } = await importModule();
    await createAndSendVerificationToken(ACCOUNT_ID, EMAIL);

    // トランザクション内でトークンが作成されている
    expect(mockTxClient.emailVerificationToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        token: expect.any(String),
        accountId: ACCOUNT_ID,
        expiresAt: expect.any(Date),
      }),
    });

    // メール送信が呼ばれている
    expect(mockSendVerificationEmail).toHaveBeenCalledWith(
      EMAIL,
      expect.any(String),
    );
  });

  it("クールダウンとトークン作成がトランザクション内で原子的に実行される（TOCTOU防止）", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockTxClient: any = {
      emailVerificationToken: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
    };
    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mockTxClient) => Promise<unknown>) =>
        callback(mockTxClient),
    );
    mockSendVerificationEmail.mockResolvedValue(undefined);

    const { createAndSendVerificationToken } = await importModule();
    await createAndSendVerificationToken(ACCOUNT_ID, EMAIL);

    // $transactionが呼ばれている（原子的実行）
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);

    // tx内でfindFirstが呼ばれている（トランザクション内でクールダウンチェック）
    expect(mockTxClient.emailVerificationToken.findFirst).toHaveBeenCalledWith({
      where: { accountId: ACCOUNT_ID },
      orderBy: { createdAt: "desc" },
    });
  });

  it("60秒以内に再送信するとエラーを返す", async () => {
    const recentToken = {
      createdAt: new Date(Date.now() - 30 * 1000), // 30秒前
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockTxClient: any = {
      emailVerificationToken: {
        findFirst: vi.fn().mockResolvedValue(recentToken),
        create: vi.fn(),
      },
    };
    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mockTxClient) => Promise<unknown>) =>
        callback(mockTxClient),
    );

    const { createAndSendVerificationToken } = await importModule();
    await expect(
      createAndSendVerificationToken(ACCOUNT_ID, EMAIL),
    ).rejects.toThrow(/秒後に可能です/);

    // トークン作成もメール送信も実行されない
    expect(mockTxClient.emailVerificationToken.create).not.toHaveBeenCalled();
    expect(mockSendVerificationEmail).not.toHaveBeenCalled();
  });

  it("60秒経過後は再送信できる", async () => {
    const oldToken = {
      createdAt: new Date(Date.now() - 61 * 1000), // 61秒前
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockTxClient: any = {
      emailVerificationToken: {
        findFirst: vi.fn().mockResolvedValue(oldToken),
        create: vi.fn().mockResolvedValue({}),
      },
    };
    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mockTxClient) => Promise<unknown>) =>
        callback(mockTxClient),
    );
    mockSendVerificationEmail.mockResolvedValue(undefined);

    const { createAndSendVerificationToken } = await importModule();
    await createAndSendVerificationToken(ACCOUNT_ID, EMAIL);

    expect(mockTxClient.emailVerificationToken.create).toHaveBeenCalled();
    expect(mockSendVerificationEmail).toHaveBeenCalled();
  });

  it("メール送信はトランザクション外で実行される", async () => {
    let transactionCompleted = false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockTxClient: any = {
      emailVerificationToken: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
    };
    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mockTxClient) => Promise<unknown>) => {
        const result = await callback(mockTxClient);
        transactionCompleted = true;
        return result;
      },
    );
    mockSendVerificationEmail.mockImplementation(() => {
      // メール送信時点でトランザクションは完了しているはず
      expect(transactionCompleted).toBe(true);
      return Promise.resolve();
    });

    const { createAndSendVerificationToken } = await importModule();
    await createAndSendVerificationToken(ACCOUNT_ID, EMAIL);

    expect(mockSendVerificationEmail).toHaveBeenCalled();
  });
});
