import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// NextAuth モック
const mockGetServerSession = vi.fn();
vi.mock("next-auth", () => ({
  getServerSession: () => mockGetServerSession(),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

// Logger モック
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Prisma モック
const mockPrisma = {
  document: { findFirst: vi.fn() },
  fragment: { findMany: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const USER_ID = "user-123";
const DOC_ID = "doc-456";

const userSession = {
  user: { accountId: "acc-1", userId: USER_ID },
};

const routeContext = { params: Promise.resolve({ id: DOC_ID }) };

function createRequest(): NextRequest {
  return new NextRequest(`http://localhost/api/documents/${DOC_ID}/fragments`, {
    method: "GET",
  });
}

describe("GET /api/documents/[id]/fragments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(userSession);
  });

  it("自分のドキュメントの Fragment を取得できる", async () => {
    mockPrisma.document.findFirst.mockResolvedValue({
      id: DOC_ID,
      userId: USER_ID,
    });
    const mockFragments = [
      {
        id: "frag-1",
        type: "ACHIEVEMENT",
        content: "売上を200%達成",
        skills: ["営業"],
        keywords: ["売上"],
        createdAt: new Date("2026-01-01"),
      },
      {
        id: "frag-2",
        type: "SKILL_USAGE",
        content: "Pythonでデータ分析基盤を構築",
        skills: ["Python", "データ分析"],
        keywords: ["基盤"],
        createdAt: new Date("2026-01-02"),
      },
    ];
    mockPrisma.fragment.findMany.mockResolvedValue(mockFragments);

    const { GET } = await import("@/app/api/documents/[id]/fragments/route");
    const res = await GET(createRequest(), routeContext);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.fragments).toHaveLength(2);
    expect(data.fragments[0].id).toBe("frag-1");
    expect(data.fragments[1].id).toBe("frag-2");

    expect(mockPrisma.document.findFirst).toHaveBeenCalledWith({
      where: { id: DOC_ID, userId: USER_ID },
    });
    expect(mockPrisma.fragment.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, sourceType: "DOCUMENT", sourceId: DOC_ID },
      select: {
        id: true,
        type: true,
        content: true,
        skills: true,
        keywords: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
  });

  it("Fragment が 0 件の場合は空配列を返す", async () => {
    mockPrisma.document.findFirst.mockResolvedValue({
      id: DOC_ID,
      userId: USER_ID,
    });
    mockPrisma.fragment.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/documents/[id]/fragments/route");
    const res = await GET(createRequest(), routeContext);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.fragments).toEqual([]);
  });

  it("未認証の場合は 401 を返す", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { GET } = await import("@/app/api/documents/[id]/fragments/route");
    const res = await GET(createRequest(), routeContext);

    expect(res.status).toBe(401);
  });

  it("存在しないドキュメントの場合は 404 を返す", async () => {
    mockPrisma.document.findFirst.mockResolvedValue(null);

    const { GET } = await import("@/app/api/documents/[id]/fragments/route");
    const res = await GET(createRequest(), routeContext);

    expect(res.status).toBe(404);
  });

  it("他ユーザーのドキュメントの場合は 404 を返す", async () => {
    // findFirst の where に userId が含まれるため、他ユーザーの場合は null が返る
    mockPrisma.document.findFirst.mockResolvedValue(null);

    const { GET } = await import("@/app/api/documents/[id]/fragments/route");
    const res = await GET(createRequest(), routeContext);

    expect(res.status).toBe(404);
  });
});
