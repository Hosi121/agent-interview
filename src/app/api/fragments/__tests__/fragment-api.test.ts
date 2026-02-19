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

const mockFragment = {
  id: "11111111-1111-1111-1111-111111111111",
  userId: "user-1",
  type: "FACT",
  content: "テストフラグメント",
  skills: ["TypeScript"],
  keywords: ["テスト"],
  sourceType: "CONVERSATION",
  confidence: 0.7,
  createdAt: new Date(),
};

describe("Fragment API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mockTxClient) => Promise<unknown>) => {
        return callback(mockTxClient);
      },
    );
  });

  describe("GET /api/fragments/[id]", () => {
    describe("正常系", () => {
      it("自分のフラグメントを取得できる", async () => {
        mockGetServerSession.mockResolvedValue(userSession);
        mockPrisma.fragment.findUnique.mockResolvedValue(mockFragment);

        const { GET } = await import("@/app/api/fragments/[id]/route");
        const request = new NextRequest(
          "http://localhost/api/fragments/11111111-1111-1111-1111-111111111111",
        );

        const response = await GET(request, {
          params: Promise.resolve({
            id: "11111111-1111-1111-1111-111111111111",
          }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.fragment.id).toBe("11111111-1111-1111-1111-111111111111");
        expect(data.fragment.content).toBe("テストフラグメント");
      });

      it("レスポンスにuserIdが含まれない", async () => {
        mockGetServerSession.mockResolvedValue(userSession);
        mockPrisma.fragment.findUnique.mockResolvedValue(mockFragment);

        const { GET } = await import("@/app/api/fragments/[id]/route");
        const request = new NextRequest(
          "http://localhost/api/fragments/11111111-1111-1111-1111-111111111111",
        );

        const response = await GET(request, {
          params: Promise.resolve({
            id: "11111111-1111-1111-1111-111111111111",
          }),
        });
        const data = await response.json();

        expect(data.fragment.userId).toBeUndefined();
      });
    });

    describe("異常系", () => {
      it("未認証の場合401を返す", async () => {
        mockGetServerSession.mockResolvedValue(null);

        const { GET } = await import("@/app/api/fragments/[id]/route");
        const request = new NextRequest(
          "http://localhost/api/fragments/11111111-1111-1111-1111-111111111111",
        );

        const response = await GET(request, {
          params: Promise.resolve({
            id: "11111111-1111-1111-1111-111111111111",
          }),
        });

        expect(response.status).toBe(401);
      });

      it("無効なUUIDの場合400を返す", async () => {
        mockGetServerSession.mockResolvedValue(userSession);

        const { GET } = await import("@/app/api/fragments/[id]/route");
        const request = new NextRequest(
          "http://localhost/api/fragments/invalid-id",
        );

        const response = await GET(request, {
          params: Promise.resolve({ id: "invalid-id" }),
        });

        expect(response.status).toBe(400);
      });

      it("存在しないフラグメントの場合404を返す", async () => {
        mockGetServerSession.mockResolvedValue(userSession);
        mockPrisma.fragment.findUnique.mockResolvedValue(null);

        const { GET } = await import("@/app/api/fragments/[id]/route");
        const request = new NextRequest(
          "http://localhost/api/fragments/11111111-1111-1111-1111-111111111111",
        );

        const response = await GET(request, {
          params: Promise.resolve({
            id: "11111111-1111-1111-1111-111111111111",
          }),
        });

        expect(response.status).toBe(404);
      });

      it("他ユーザーのフラグメントの場合403を返す", async () => {
        mockGetServerSession.mockResolvedValue(otherUserSession);
        mockPrisma.fragment.findUnique.mockResolvedValue(mockFragment);

        const { GET } = await import("@/app/api/fragments/[id]/route");
        const request = new NextRequest(
          "http://localhost/api/fragments/11111111-1111-1111-1111-111111111111",
        );

        const response = await GET(request, {
          params: Promise.resolve({
            id: "11111111-1111-1111-1111-111111111111",
          }),
        });

        expect(response.status).toBe(403);
      });
    });
  });

  describe("DELETE /api/fragments/[id]", () => {
    describe("正常系", () => {
      it("自分のフラグメントを削除できる", async () => {
        mockGetServerSession.mockResolvedValue(userSession);
        mockPrisma.fragment.findUnique.mockResolvedValue(mockFragment);

        const { DELETE } = await import("@/app/api/fragments/[id]/route");
        const request = new NextRequest(
          "http://localhost/api/fragments/11111111-1111-1111-1111-111111111111",
          { method: "DELETE" },
        );

        const response = await DELETE(request, {
          params: Promise.resolve({
            id: "11111111-1111-1111-1111-111111111111",
          }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
      });

      it("削除時にトランザクション内で関連レコードも削除される", async () => {
        mockGetServerSession.mockResolvedValue(userSession);
        mockPrisma.fragment.findUnique.mockResolvedValue(mockFragment);

        const { DELETE } = await import("@/app/api/fragments/[id]/route");
        const request = new NextRequest(
          "http://localhost/api/fragments/11111111-1111-1111-1111-111111111111",
          { method: "DELETE" },
        );

        await DELETE(request, {
          params: Promise.resolve({
            id: "11111111-1111-1111-1111-111111111111",
          }),
        });

        expect(mockPrisma.$transaction).toHaveBeenCalled();
        expect(mockTxClient.messageReference.deleteMany).toHaveBeenCalledWith({
          where: {
            refType: "FRAGMENT",
            refId: "11111111-1111-1111-1111-111111111111",
          },
        });
        expect(mockTxClient.tagging.deleteMany).toHaveBeenCalledWith({
          where: {
            taggableType: "FRAGMENT",
            taggableId: "11111111-1111-1111-1111-111111111111",
          },
        });
        expect(mockTxClient.fragment.updateMany).toHaveBeenCalledWith({
          where: { parentId: "11111111-1111-1111-1111-111111111111" },
          data: { parentId: null },
        });
        expect(mockTxClient.fragment.delete).toHaveBeenCalledWith({
          where: { id: "11111111-1111-1111-1111-111111111111" },
        });
      });
    });

    describe("異常系", () => {
      it("未認証の場合401を返す", async () => {
        mockGetServerSession.mockResolvedValue(null);

        const { DELETE } = await import("@/app/api/fragments/[id]/route");
        const request = new NextRequest(
          "http://localhost/api/fragments/11111111-1111-1111-1111-111111111111",
          { method: "DELETE" },
        );

        const response = await DELETE(request, {
          params: Promise.resolve({
            id: "11111111-1111-1111-1111-111111111111",
          }),
        });

        expect(response.status).toBe(401);
      });

      it("他ユーザーのフラグメントは削除できない", async () => {
        mockGetServerSession.mockResolvedValue(otherUserSession);
        mockPrisma.fragment.findUnique.mockResolvedValue(mockFragment);

        const { DELETE } = await import("@/app/api/fragments/[id]/route");
        const request = new NextRequest(
          "http://localhost/api/fragments/11111111-1111-1111-1111-111111111111",
          { method: "DELETE" },
        );

        const response = await DELETE(request, {
          params: Promise.resolve({
            id: "11111111-1111-1111-1111-111111111111",
          }),
        });

        expect(response.status).toBe(403);
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      });

      it("存在しないフラグメントの場合404を返す", async () => {
        mockGetServerSession.mockResolvedValue(userSession);
        mockPrisma.fragment.findUnique.mockResolvedValue(null);

        const { DELETE } = await import("@/app/api/fragments/[id]/route");
        const request = new NextRequest(
          "http://localhost/api/fragments/11111111-1111-1111-1111-111111111111",
          { method: "DELETE" },
        );

        const response = await DELETE(request, {
          params: Promise.resolve({
            id: "11111111-1111-1111-1111-111111111111",
          }),
        });

        expect(response.status).toBe(404);
      });
    });
  });
});
