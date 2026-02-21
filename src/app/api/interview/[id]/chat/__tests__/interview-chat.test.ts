/**
 * 面談チャット（エージェント会話）API テスト
 *
 * 課金を伴うクリティカルパス:
 * - 新規セッション作成時に CONVERSATION (1pt) を消費
 * - 既存セッションがあればポイント消費なし
 * - 同時リクエストによる二重課金を防止
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── モック定義 ──────────────────────────────────────

const mockGetServerSession = vi.fn();
vi.mock("next-auth", () => ({
  getServerSession: () => mockGetServerSession(),
}));
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

// Prisma トランザクション用クライアント
const mockTxClient = {
  session: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
};

const mockPrisma = {
  agentProfile: { findUnique: vi.fn() },
  jobPosting: { findFirst: vi.fn() },
  session: { findFirst: vi.fn() },
  message: { create: vi.fn() },
  fragment: { findMany: vi.fn() },
  messageReference: { createMany: vi.fn() },
  companyAccess: { findUnique: vi.fn() },
  $transaction: vi.fn(),
};
vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

// consumePointsWithOperations モック
const mockConsumePointsWithOperations = vi.fn();
vi.mock("@/lib/points", () => ({
  consumePointsWithOperations: (...args: unknown[]) =>
    mockConsumePointsWithOperations(...args),
}));

// OpenAI モック
const mockGenerateChatResponse = vi.fn();
const mockGenerateFollowUpQuestions = vi.fn();
vi.mock("@/lib/openai", () => ({
  generateChatResponse: (...args: unknown[]) =>
    mockGenerateChatResponse(...args),
  generateFollowUpQuestions: (...args: unknown[]) =>
    mockGenerateFollowUpQuestions(...args),
}));

// coverage モック
vi.mock("@/lib/coverage", () => ({
  calculateCoverage: () => ({
    percentage: 50,
    isComplete: false,
    categories: [
      { label: "スキル", fulfilled: true, current: 2, required: 1 },
      { label: "経験", fulfilled: false, current: 0, required: 1 },
    ],
  }),
}));

// logger モック
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ── テストデータ ──────────────────────────────────────

const recruiterSession = {
  user: {
    accountId: "account-r1",
    accountType: "RECRUITER",
    recruiterId: "recruiter-1",
    companyId: "company-1",
    companyRole: "OWNER",
    recruiterStatus: "ACTIVE",
  },
};

const mockAgent = {
  id: "agent-1",
  userId: "user-1",
  systemPrompt: "あなたはテスト太郎のAIエージェントです。",
  status: "PUBLIC",
  createdAt: new Date(),
  updatedAt: new Date(),
  user: {
    id: "user-1",
    accountId: "account-u1",
    name: "テスト太郎",
    email: "taro@example.com",
    phone: null,
    avatarPath: null,
  },
};

const mockExistingSession = {
  id: "session-1",
  sessionType: "RECRUITER_AGENT_CHAT",
  recruiterId: "recruiter-1",
  agentId: "agent-1",
  createdAt: new Date(),
  messages: [
    {
      id: "msg-1",
      sessionId: "session-1",
      senderType: "RECRUITER",
      senderId: "recruiter-1",
      content: "前回の質問です",
      createdAt: new Date("2026-01-01"),
    },
    {
      id: "msg-2",
      sessionId: "session-1",
      senderType: "AI",
      senderId: null,
      content: "前回のAI回答です",
      createdAt: new Date("2026-01-01"),
    },
  ],
};

const mockNewSession = {
  id: "session-new",
  sessionType: "RECRUITER_AGENT_CHAT",
  recruiterId: "recruiter-1",
  agentId: "agent-1",
  createdAt: new Date(),
  messages: [],
};

const mockFragments = [
  {
    id: "frag-1",
    type: "SKILL_USAGE",
    content: "TypeScriptでフロントエンド開発を3年間担当",
    skills: ["TypeScript", "React"],
    keywords: ["フロントエンド"],
  },
];

const mockAiMessage = {
  id: "ai-msg-1",
  sessionId: "session-1",
  senderType: "AI",
  content: "テスト太郎はTypeScriptの経験があります。",
  createdAt: new Date(),
};

// ── ヘルパー ──────────────────────────────────────

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/interview/agent-1/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function setupDefaultMocks() {
  mockGetServerSession.mockResolvedValue(recruiterSession);
  mockPrisma.agentProfile.findUnique.mockResolvedValue(mockAgent);
  mockPrisma.companyAccess.findUnique.mockResolvedValue(null); // アクセス拒否なし
  mockPrisma.fragment.findMany.mockResolvedValue(mockFragments);
  mockPrisma.message.create.mockResolvedValue(mockAiMessage);
  mockPrisma.messageReference.createMany.mockResolvedValue({ count: 1 });
  mockGenerateChatResponse.mockResolvedValue(
    "テスト太郎はTypeScriptの経験があります。",
  );
}

// ── テスト ──────────────────────────────────────

describe("POST /api/interview/[id]/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    it("既存セッションがある場合、ポイント消費なしでAI応答を返す", async () => {
      setupDefaultMocks();
      mockPrisma.session.findFirst.mockResolvedValue(mockExistingSession);

      const { POST } = await import("@/app/api/interview/[id]/chat/route");
      const request = makeRequest({
        message: "TypeScriptの経験はありますか？",
      });
      const response = await POST(request, {
        params: Promise.resolve({ id: "agent-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("テスト太郎はTypeScriptの経験があります。");
      // ポイント消費は呼ばれない
      expect(mockConsumePointsWithOperations).not.toHaveBeenCalled();
    });

    it("新規セッション作成時にポイントを消費してセッションを作成する", async () => {
      setupDefaultMocks();
      mockPrisma.session.findFirst.mockResolvedValue(null); // 既存セッションなし
      mockConsumePointsWithOperations.mockImplementation(
        async (
          _companyId: string,
          _action: string,
          operations: (tx: typeof mockTxClient) => Promise<unknown>,
        ) => {
          // tx内で既存セッションなし（正常パス）
          mockTxClient.session.findFirst.mockResolvedValue(null);
          mockTxClient.session.create.mockResolvedValue(mockNewSession);
          const result = await operations(mockTxClient);
          return { newBalance: 99, consumed: 1, result };
        },
      );

      const { POST } = await import("@/app/api/interview/[id]/chat/route");
      const request = makeRequest({ message: "自己紹介をお願いします" });
      const response = await POST(request, {
        params: Promise.resolve({ id: "agent-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBeDefined();
      expect(mockConsumePointsWithOperations).toHaveBeenCalledWith(
        "company-1",
        "CONVERSATION",
        expect.any(Function),
        undefined,
        "エージェント会話: テスト太郎",
      );
      // トランザクション内でセッション作成が呼ばれる
      expect(mockTxClient.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sessionType: "RECRUITER_AGENT_CHAT",
            recruiterId: "recruiter-1",
            agentId: "agent-1",
          }),
        }),
      );
    });

    it("AI応答にフラグメント参照情報が含まれる", async () => {
      setupDefaultMocks();
      mockPrisma.session.findFirst.mockResolvedValue(mockExistingSession);

      const { POST } = await import("@/app/api/interview/[id]/chat/route");
      // "TypeScript" はフラグメントのスキルに一致するのでスコアが付く
      const request = makeRequest({
        message: "TypeScriptの経験について教えてください",
      });
      const response = await POST(request, {
        params: Promise.resolve({ id: "agent-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.references).toBeDefined();
      expect(Array.isArray(data.references)).toBe(true);
      // TypeScript を含むメッセージなので関連フラグメントが見つかる
      if (data.references.length > 0) {
        expect(data.references[0]).toHaveProperty("id");
        expect(data.references[0]).toHaveProperty("type");
        expect(data.references[0]).toHaveProperty("skills");
      }
    });

    it("求人情報を指定した場合、フォローアップ質問が返る", async () => {
      setupDefaultMocks();
      mockPrisma.session.findFirst.mockResolvedValue(mockExistingSession);
      mockPrisma.jobPosting.findFirst.mockResolvedValue({
        id: "job-1",
        recruiterId: "recruiter-1",
        title: "フロントエンドエンジニア",
        description: "React/TypeScript開発",
        skills: ["React", "TypeScript"],
        experienceLevel: "MID",
      });
      mockGenerateFollowUpQuestions.mockResolvedValue([
        "チーム規模はどのくらいでしたか？",
        "技術選定に携わった経験はありますか？",
      ]);

      const { POST } = await import("@/app/api/interview/[id]/chat/route");
      const request = makeRequest({
        message: "TypeScriptの経験はありますか？",
        jobId: "job-1",
      });
      const response = await POST(request, {
        params: Promise.resolve({ id: "agent-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.followUps).toEqual([
        "チーム規模はどのくらいでしたか？",
        "技術選定に携わった経験はありますか？",
      ]);
    });

    it("フォローアップ質問の生成失敗は無視される", async () => {
      setupDefaultMocks();
      mockPrisma.session.findFirst.mockResolvedValue(mockExistingSession);
      mockPrisma.jobPosting.findFirst.mockResolvedValue({
        id: "job-1",
        recruiterId: "recruiter-1",
        title: "エンジニア",
        description: "開発",
        skills: [],
        experienceLevel: "MID",
      });
      mockGenerateFollowUpQuestions.mockRejectedValue(
        new Error("OpenAI error"),
      );

      const { POST } = await import("@/app/api/interview/[id]/chat/route");
      const request = makeRequest({
        message: "経験を教えてください",
        jobId: "job-1",
      });
      const response = await POST(request, {
        params: Promise.resolve({ id: "agent-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.followUps).toEqual([]);
    });
  });

  describe("同時リクエスト保護", () => {
    it("トランザクション内で既存セッションが検出された場合、ポイント消費せず既存セッションを使用する", async () => {
      setupDefaultMocks();
      // 初回チェック: セッションなし
      mockPrisma.session.findFirst
        .mockResolvedValueOnce(null)
        // DuplicateSessionError後の再取得
        .mockResolvedValueOnce(mockExistingSession);

      mockConsumePointsWithOperations.mockImplementation(
        async (
          _companyId: string,
          _action: string,
          operations: (tx: typeof mockTxClient) => Promise<unknown>,
        ) => {
          // tx内で既存セッション発見 → DuplicateSessionErrorをスロー
          mockTxClient.session.findFirst.mockResolvedValue(mockExistingSession);
          return operations(mockTxClient);
          // DuplicateSessionError がスローされ、トランザクションはロールバック
        },
      );

      const { POST } = await import("@/app/api/interview/[id]/chat/route");
      const request = makeRequest({ message: "テストメッセージ" });
      const response = await POST(request, {
        params: Promise.resolve({ id: "agent-1" }),
      });
      const data = await response.json();

      // 正常にレスポンスが返る（既存セッションで続行）
      expect(response.status).toBe(200);
      expect(data.message).toBeDefined();
      // セッション作成は呼ばれない（既存セッションを使用）
      expect(mockTxClient.session.create).not.toHaveBeenCalled();
    });
  });

  describe("異常系", () => {
    it("未認証の場合401を返す", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const { POST } = await import("@/app/api/interview/[id]/chat/route");
      const request = makeRequest({ message: "テスト" });
      const response = await POST(request, {
        params: Promise.resolve({ id: "agent-1" }),
      });

      expect(response.status).toBe(401);
    });

    it("メッセージが空の場合400を返す", async () => {
      mockGetServerSession.mockResolvedValue(recruiterSession);

      const { POST } = await import("@/app/api/interview/[id]/chat/route");
      const request = makeRequest({ message: "" });
      const response = await POST(request, {
        params: Promise.resolve({ id: "agent-1" }),
      });

      expect(response.status).toBe(400);
    });

    it("エージェントが存在しない場合404を返す", async () => {
      mockGetServerSession.mockResolvedValue(recruiterSession);
      mockPrisma.agentProfile.findUnique.mockResolvedValue(null);

      const { POST } = await import("@/app/api/interview/[id]/chat/route");
      const request = makeRequest({ message: "テスト" });
      const response = await POST(request, {
        params: Promise.resolve({ id: "nonexistent" }),
      });

      expect(response.status).toBe(404);
    });

    it("エージェントが非公開の場合403を返す", async () => {
      mockGetServerSession.mockResolvedValue(recruiterSession);
      mockPrisma.agentProfile.findUnique.mockResolvedValue({
        ...mockAgent,
        status: "PRIVATE",
      });

      const { POST } = await import("@/app/api/interview/[id]/chat/route");
      const request = makeRequest({ message: "テスト" });
      const response = await POST(request, {
        params: Promise.resolve({ id: "agent-1" }),
      });

      expect(response.status).toBe(403);
    });

    it("会社のアクセスが拒否されている場合403を返す", async () => {
      mockGetServerSession.mockResolvedValue(recruiterSession);
      mockPrisma.agentProfile.findUnique.mockResolvedValue(mockAgent);
      mockPrisma.companyAccess.findUnique.mockResolvedValue({
        status: "DENY",
      });

      const { POST } = await import("@/app/api/interview/[id]/chat/route");
      const request = makeRequest({ message: "テスト" });
      const response = await POST(request, {
        params: Promise.resolve({ id: "agent-1" }),
      });

      expect(response.status).toBe(403);
    });

    it("指定された求人が存在しない場合404を返す", async () => {
      setupDefaultMocks();
      mockPrisma.session.findFirst.mockResolvedValue(mockExistingSession);
      mockPrisma.jobPosting.findFirst.mockResolvedValue(null);

      const { POST } = await import("@/app/api/interview/[id]/chat/route");
      const request = makeRequest({
        message: "テスト",
        jobId: "nonexistent-job",
      });
      const response = await POST(request, {
        params: Promise.resolve({ id: "agent-1" }),
      });

      expect(response.status).toBe(404);
    });

    it("ポイント不足の場合、consumePointsWithOperationsのエラーが伝播する", async () => {
      setupDefaultMocks();
      mockPrisma.session.findFirst.mockResolvedValue(null); // 新規セッション

      const { InsufficientPointsError } = await import("@/lib/errors");
      mockConsumePointsWithOperations.mockRejectedValue(
        new InsufficientPointsError(1, 0),
      );

      const { POST } = await import("@/app/api/interview/[id]/chat/route");
      const request = makeRequest({ message: "テスト" });
      const response = await POST(request, {
        params: Promise.resolve({ id: "agent-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(402);
      expect(data.code).toBe("INSUFFICIENT_POINTS");
    });
  });
});
