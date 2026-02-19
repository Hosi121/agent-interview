import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// NextAuth モック
const mockGetServerSession = vi.fn();
vi.mock("next-auth", () => ({
  getServerSession: () => mockGetServerSession(),
}));
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

// Prisma トランザクション用クライアント
const mockTxClient = {
  fragment: {
    delete: vi.fn(),
    updateMany: vi.fn(),
    createMany: vi.fn(),
  },
  messageReference: { deleteMany: vi.fn() },
  tagging: { deleteMany: vi.fn() },
};

// Prisma メインクライアント
const mockPrisma = {
  fragment: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

const userSession = {
  user: {
    accountId: "account-1",
    userId: "user-1",
  },
};

const otherUserSession = {
  user: {
    accountId: "account-2",
    userId: "user-2",
  },
};

const fragmentId = "11111111-1111-1111-1111-111111111111";

const mockFragment = {
  id: fragmentId,
  userId: "user-1",
  type: "FACT",
  content: "テストフラグメント",
  skills: ["TypeScript"],
  keywords: ["テスト"],
  sourceType: "CONVERSATION",
  confidence: 0.7,
  createdAt: new Date(),
};

const validBody = {
  newFragments: [
    {
      type: "SKILL_USAGE",
      content: "修正後のフラグメント内容",
      skills: ["React"],
      keywords: ["フロントエンド"],
      quality: "high",
    },
  ],
};

describe("POST /api/fragments/[id]/correct", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mockTxClient) => Promise<unknown>) => {
        return callback(mockTxClient);
      },
    );
  });

  describe("正常系", () => {
    it("フラグメントを修正できる（旧フラグメント削除 + 新フラグメント作成）", async () => {
      mockGetServerSession.mockResolvedValue(userSession);
      mockPrisma.fragment.findUnique.mockResolvedValue(mockFragment);

      const { POST } = await import("@/app/api/fragments/[id]/correct/route");
      const request = new NextRequest(
        `http://localhost/api/fragments/${fragmentId}/correct`,
        {
          method: "POST",
          body: JSON.stringify(validBody),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: fragmentId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("トランザクション内で新フラグメント作成と旧フラグメント削除がアトミックに行われる", async () => {
      mockGetServerSession.mockResolvedValue(userSession);
      mockPrisma.fragment.findUnique.mockResolvedValue(mockFragment);

      const { POST } = await import("@/app/api/fragments/[id]/correct/route");
      const request = new NextRequest(
        `http://localhost/api/fragments/${fragmentId}/correct`,
        {
          method: "POST",
          body: JSON.stringify(validBody),
        },
      );

      await POST(request, {
        params: Promise.resolve({ id: fragmentId }),
      });

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);

      // 新フラグメントの作成
      expect(mockTxClient.fragment.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            userId: "user-1",
            type: "SKILL_USAGE",
            content: "修正後のフラグメント内容",
            skills: ["React"],
            keywords: ["フロントエンド"],
            sourceType: "CONVERSATION",
            confidence: 1.0, // quality: "high" → 1.0
          }),
        ],
      });

      // 旧フラグメントの関連レコード削除
      expect(mockTxClient.messageReference.deleteMany).toHaveBeenCalledWith({
        where: { refType: "FRAGMENT", refId: fragmentId },
      });
      expect(mockTxClient.tagging.deleteMany).toHaveBeenCalledWith({
        where: { taggableType: "FRAGMENT", taggableId: fragmentId },
      });
      expect(mockTxClient.fragment.updateMany).toHaveBeenCalledWith({
        where: { parentId: fragmentId },
        data: { parentId: null },
      });
      expect(mockTxClient.fragment.delete).toHaveBeenCalledWith({
        where: { id: fragmentId },
      });
    });

    it("複数の新フラグメントで修正できる", async () => {
      mockGetServerSession.mockResolvedValue(userSession);
      mockPrisma.fragment.findUnique.mockResolvedValue(mockFragment);

      const multiBody = {
        newFragments: [
          {
            type: "FACT",
            content: "修正1",
            skills: [],
            keywords: [],
            quality: "medium",
          },
          {
            type: "ACHIEVEMENT",
            content: "修正2",
            skills: ["Go"],
            keywords: [],
            quality: "low",
          },
        ],
      };

      const { POST } = await import("@/app/api/fragments/[id]/correct/route");
      const request = new NextRequest(
        `http://localhost/api/fragments/${fragmentId}/correct`,
        {
          method: "POST",
          body: JSON.stringify(multiBody),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: fragmentId }),
      });

      expect(response.status).toBe(200);
      expect(mockTxClient.fragment.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ content: "修正1", confidence: 0.7 }),
          expect.objectContaining({ content: "修正2", confidence: 0.4 }),
        ]),
      });
    });
  });

  describe("異常系", () => {
    it("未認証の場合401を返す", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const { POST } = await import("@/app/api/fragments/[id]/correct/route");
      const request = new NextRequest(
        `http://localhost/api/fragments/${fragmentId}/correct`,
        {
          method: "POST",
          body: JSON.stringify(validBody),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: fragmentId }),
      });

      expect(response.status).toBe(401);
    });

    it("他ユーザーのフラグメントは修正できない", async () => {
      mockGetServerSession.mockResolvedValue(otherUserSession);
      mockPrisma.fragment.findUnique.mockResolvedValue(mockFragment);

      const { POST } = await import("@/app/api/fragments/[id]/correct/route");
      const request = new NextRequest(
        `http://localhost/api/fragments/${fragmentId}/correct`,
        {
          method: "POST",
          body: JSON.stringify(validBody),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: fragmentId }),
      });

      expect(response.status).toBe(403);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("存在しないフラグメントの場合404を返す", async () => {
      mockGetServerSession.mockResolvedValue(userSession);
      mockPrisma.fragment.findUnique.mockResolvedValue(null);

      const { POST } = await import("@/app/api/fragments/[id]/correct/route");
      const request = new NextRequest(
        `http://localhost/api/fragments/${fragmentId}/correct`,
        {
          method: "POST",
          body: JSON.stringify(validBody),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: fragmentId }),
      });

      expect(response.status).toBe(404);
    });

    it("無効なUUIDの場合400を返す", async () => {
      mockGetServerSession.mockResolvedValue(userSession);

      const { POST } = await import("@/app/api/fragments/[id]/correct/route");
      const request = new NextRequest(
        "http://localhost/api/fragments/invalid-uuid/correct",
        {
          method: "POST",
          body: JSON.stringify(validBody),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: "invalid-uuid" }),
      });

      expect(response.status).toBe(400);
    });

    it("無効なFragmentTypeの場合400を返す", async () => {
      mockGetServerSession.mockResolvedValue(userSession);

      const { POST } = await import("@/app/api/fragments/[id]/correct/route");
      const request = new NextRequest(
        `http://localhost/api/fragments/${fragmentId}/correct`,
        {
          method: "POST",
          body: JSON.stringify({
            newFragments: [
              {
                type: "INVALID_TYPE",
                content: "test",
                skills: [],
                keywords: [],
              },
            ],
          }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: fragmentId }),
      });

      expect(response.status).toBe(400);
    });

    it("空のnewFragments配列の場合400を返す", async () => {
      mockGetServerSession.mockResolvedValue(userSession);

      const { POST } = await import("@/app/api/fragments/[id]/correct/route");
      const request = new NextRequest(
        `http://localhost/api/fragments/${fragmentId}/correct`,
        {
          method: "POST",
          body: JSON.stringify({ newFragments: [] }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: fragmentId }),
      });

      expect(response.status).toBe(400);
    });
  });
});
