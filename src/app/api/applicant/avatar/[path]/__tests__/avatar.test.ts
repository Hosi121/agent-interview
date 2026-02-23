import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// NextAuth モック
const mockGetServerSession = vi.fn();
vi.mock("next-auth", () => ({
  getServerSession: () => mockGetServerSession(),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

// Logger モック
const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
vi.mock("@/lib/logger", () => ({ logger: mockLogger }));

// MinIO モック
const mockGetFileUrl = vi.fn();
vi.mock("@/lib/minio", () => ({
  getFileUrl: (...args: unknown[]) => mockGetFileUrl(...args),
}));

const authenticatedSession = {
  user: { accountId: "acc-1", email: "test@example.com" },
};

function createRequest(): NextRequest {
  return new NextRequest(
    "http://localhost/api/applicant/avatar/avatars/test.png",
    {
      method: "GET",
    },
  );
}

describe("GET /api/applicant/avatar/[path]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(authenticatedSession);
    mockGetFileUrl.mockResolvedValue("https://minio.example.com/presigned-url");
  });

  describe("認証", () => {
    it("未認証の場合は401を返す", async () => {
      mockGetServerSession.mockResolvedValue(null);
      const { GET } = await import("@/app/api/applicant/avatar/[path]/route");

      const res = await GET(createRequest(), {
        params: Promise.resolve({ path: "avatars/test.png" }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("パスバリデーション", () => {
    it("avatars/で始まらないパスは404を返す", async () => {
      const { GET } = await import("@/app/api/applicant/avatar/[path]/route");

      const res = await GET(createRequest(), {
        params: Promise.resolve({ path: "documents/secret.pdf" }),
      });
      expect(res.status).toBe(404);
    });

    it("空のパスは404を返す", async () => {
      const { GET } = await import("@/app/api/applicant/avatar/[path]/route");

      const res = await GET(createRequest(), {
        params: Promise.resolve({ path: "" }),
      });
      expect(res.status).toBe(404);
    });

    it("パストラバーサル（avatars/../）は404を返す", async () => {
      const { GET } = await import("@/app/api/applicant/avatar/[path]/route");

      const res = await GET(createRequest(), {
        params: Promise.resolve({ path: "avatars/../documents/secret.pdf" }),
      });
      expect(res.status).toBe(404);
      // getFileUrlは呼ばれない
      expect(mockGetFileUrl).not.toHaveBeenCalled();
    });

    it("パストラバーサル（avatars/../../etc/passwd）は404を返す", async () => {
      const { GET } = await import("@/app/api/applicant/avatar/[path]/route");

      const res = await GET(createRequest(), {
        params: Promise.resolve({ path: "avatars/../../etc/passwd" }),
      });
      expect(res.status).toBe(404);
      expect(mockGetFileUrl).not.toHaveBeenCalled();
    });

    it("パストラバーサル（avatars/sub/../../secret）は404を返す", async () => {
      const { GET } = await import("@/app/api/applicant/avatar/[path]/route");

      const res = await GET(createRequest(), {
        params: Promise.resolve({
          path: "avatars/sub/../../secret.txt",
        }),
      });
      expect(res.status).toBe(404);
      expect(mockGetFileUrl).not.toHaveBeenCalled();
    });

    it("冗長なスラッシュは正規化して処理する", async () => {
      const { GET } = await import("@/app/api/applicant/avatar/[path]/route");

      const res = await GET(createRequest(), {
        params: Promise.resolve({ path: "avatars//test.png" }),
      });
      // 正規化後 "avatars/test.png" になるのでOK
      expect(res.status).toBe(307);
      expect(mockGetFileUrl).toHaveBeenCalledWith("avatars/test.png");
    });
  });

  describe("正常系", () => {
    it("正常なパスの場合はpresigned URLにリダイレクトする", async () => {
      const { GET } = await import("@/app/api/applicant/avatar/[path]/route");

      const res = await GET(createRequest(), {
        params: Promise.resolve({ path: "avatars/abc123-photo.png" }),
      });
      expect(res.status).toBe(307);
      expect(mockGetFileUrl).toHaveBeenCalledWith("avatars/abc123-photo.png");
    });

    it("サブディレクトリも許可する", async () => {
      const { GET } = await import("@/app/api/applicant/avatar/[path]/route");

      const res = await GET(createRequest(), {
        params: Promise.resolve({ path: "avatars/user1/photo.jpg" }),
      });
      expect(res.status).toBe(307);
      expect(mockGetFileUrl).toHaveBeenCalledWith("avatars/user1/photo.jpg");
    });
  });
});
