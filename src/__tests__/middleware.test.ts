import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// next-auth/jwt モック
const mockGetToken = vi.fn();
vi.mock("next-auth/jwt", () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
}));

// middleware を動的インポート（モック適用後）
async function getMiddleware() {
  const mod = await import("../../middleware");
  return mod.middleware;
}

function createRequest(pathname: string, baseUrl = "http://localhost:3000") {
  return new NextRequest(new URL(pathname, baseUrl));
}

function validToken(overrides = {}) {
  return {
    email: "test@example.com",
    accountType: "USER",
    emailVerified: true,
    passkeyVerificationRequired: false,
    ...overrides,
  };
}

describe("middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue(null);
  });

  // ── 公開ルート ──────────────────────────────────────────

  describe("公開ルート（認証不要）", () => {
    it.each([
      "/",
      "/login",
      "/register",
      "/invite",
      "/check-email",
      "/verify-email",
    ])("%s はそのまま通過する", async (path) => {
      const middleware = await getMiddleware();
      const res = await middleware(createRequest(path));
      expect(res.status).toBe(200);
      expect(res.headers.get("x-middleware-rewrite")).toBeFalsy();
    });

    it("公開ルートのサブパスも通過する（/invite/abc）", async () => {
      const middleware = await getMiddleware();
      const res = await middleware(createRequest("/invite/abc"));
      expect(res.status).toBe(200);
    });

    it("静的ファイル（拡張子付き）はスキップする", async () => {
      const middleware = await getMiddleware();
      const res = await middleware(createRequest("/image.png"));
      expect(res.status).toBe(200);
    });
  });

  // ── 認証不要のAPIルート ────────────────────────────────

  describe("認証不要のAPIルート", () => {
    it("/api/auth/* はJWTなしで通過する", async () => {
      const middleware = await getMiddleware();
      const res = await middleware(createRequest("/api/auth/register"));
      expect(res.status).toBe(200);
    });

    it("/api/webhooks/* はJWTなしで通過する", async () => {
      const middleware = await getMiddleware();
      const res = await middleware(createRequest("/api/webhooks/stripe"));
      expect(res.status).toBe(200);
    });

    it("/api/health はJWTなしで通過する", async () => {
      const middleware = await getMiddleware();
      const res = await middleware(createRequest("/api/health"));
      expect(res.status).toBe(200);
    });

    it("/api/internal/* はJWTなしで通過する（APIキー認証を使用）", async () => {
      const middleware = await getMiddleware();
      const res = await middleware(
        createRequest("/api/internal/analysis-callback"),
      );
      expect(res.status).toBe(200);
    });

    it("/api/internal/expire-points はJWTなしで通過する", async () => {
      const middleware = await getMiddleware();
      const res = await middleware(
        createRequest("/api/internal/expire-points"),
      );
      expect(res.status).toBe(200);
    });
  });

  // ── 未認証アクセス ────────────────────────────────────

  describe("未認証アクセス", () => {
    it("保護されたページは/loginにリダイレクトされる", async () => {
      const middleware = await getMiddleware();
      const res = await middleware(createRequest("/my/dashboard"));
      expect(res.status).toBe(307);
      const location = res.headers.get("location");
      expect(location).toContain("/login");
      expect(location).toContain("callbackUrl=%2Fmy%2Fdashboard");
    });

    it("保護されたAPIは401を返す", async () => {
      const middleware = await getMiddleware();
      const res = await middleware(createRequest("/api/agents/me"));
      expect(res.status).toBe(401);
    });
  });

  // ── 2FA検証 ───────────────────────────────────────────

  describe("2FA検証が必要な場合", () => {
    beforeEach(() => {
      mockGetToken.mockResolvedValue(
        validToken({ passkeyVerificationRequired: true }),
      );
    });

    it("APIルートは403を返す", async () => {
      const middleware = await getMiddleware();
      const res = await middleware(createRequest("/api/agents/me"));
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain("2FA");
    });

    it("/verify-passkeyは通過する", async () => {
      const middleware = await getMiddleware();
      const res = await middleware(createRequest("/verify-passkey"));
      expect(res.status).toBe(200);
    });

    it("その他のページは/verify-passkeyにリダイレクトされる", async () => {
      const middleware = await getMiddleware();
      const res = await middleware(createRequest("/my/dashboard"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/verify-passkey");
    });
  });

  // ── メール未認証 ──────────────────────────────────────

  describe("メール未認証ユーザー", () => {
    beforeEach(() => {
      mockGetToken.mockResolvedValue(validToken({ emailVerified: false }));
    });

    it("APIルートは403を返す", async () => {
      const middleware = await getMiddleware();
      const res = await middleware(createRequest("/api/agents/me"));
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain("Email not verified");
    });

    it("ページは/check-emailにリダイレクトされる", async () => {
      const middleware = await getMiddleware();
      const res = await middleware(createRequest("/my/dashboard"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/check-email");
    });
  });

  // ── ロールベースルーティング ───────────────────────────

  describe("ロールベースルーティング", () => {
    it("RECRUITERが/myにアクセスすると/recruiter/dashboardにリダイレクト", async () => {
      mockGetToken.mockResolvedValue(validToken({ accountType: "RECRUITER" }));
      const middleware = await getMiddleware();
      const res = await middleware(createRequest("/my/dashboard"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/recruiter/dashboard");
    });

    it("USERが/recruiterにアクセスすると/my/dashboardにリダイレクト", async () => {
      mockGetToken.mockResolvedValue(validToken({ accountType: "USER" }));
      const middleware = await getMiddleware();
      const res = await middleware(createRequest("/recruiter/dashboard"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/my/dashboard");
    });

    it("USERが/my/dashboardに正常アクセスできる", async () => {
      mockGetToken.mockResolvedValue(validToken({ accountType: "USER" }));
      const middleware = await getMiddleware();
      const res = await middleware(createRequest("/my/dashboard"));
      expect(res.status).toBe(200);
    });

    it("RECRUITERが/recruiter/dashboardに正常アクセスできる", async () => {
      mockGetToken.mockResolvedValue(validToken({ accountType: "RECRUITER" }));
      const middleware = await getMiddleware();
      const res = await middleware(createRequest("/recruiter/dashboard"));
      expect(res.status).toBe(200);
    });
  });

  // ── /verify-passkey の不要アクセス ─────────────────────

  describe("/verify-passkey の不要アクセス", () => {
    it("2FA不要のUSERはダッシュボードにリダイレクトされる", async () => {
      mockGetToken.mockResolvedValue(validToken({ accountType: "USER" }));
      const middleware = await getMiddleware();
      const res = await middleware(createRequest("/verify-passkey"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/my/dashboard");
    });

    it("2FA不要のRECRUITERはリクルーターダッシュボードにリダイレクトされる", async () => {
      mockGetToken.mockResolvedValue(validToken({ accountType: "RECRUITER" }));
      const middleware = await getMiddleware();
      const res = await middleware(createRequest("/verify-passkey"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/recruiter/dashboard");
    });
  });
});
