/**
 * パスキーAPI - 結合テスト
 *
 * テストケース:
 * - GET /api/auth/passkey: 登録済みパスキー一覧取得
 * - DELETE /api/auth/passkey/[id]: パスキー削除（所有者チェック）
 * - POST register/options: 登録オプション生成（上限チェック）
 * - POST register/verify: 登録レスポンス検証（チャレンジ検証）
 * - POST authenticate/options: 認証オプション生成
 * - POST authenticate/verify: 認証レスポンス検証（カウンター、クローン検出）
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// NextAuthのモック
const mockGetServerSession = vi.fn();
vi.mock("next-auth", () => ({
  getServerSession: () => mockGetServerSession(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

// cookies()のモック
const mockCookieStore = {
  get: vi.fn(),
  delete: vi.fn(),
};
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

// Prismaのモック
const mockPrisma = {
  account: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
  passkey: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  },
  webAuthnChallenge: {
    create: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// simplewebauthn のモック
const mockGenerateRegistrationOptions = vi.fn();
const mockVerifyRegistrationResponse = vi.fn();
const mockGenerateAuthenticationOptions = vi.fn();
const mockVerifyAuthenticationResponse = vi.fn();

vi.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions: (...args: unknown[]) =>
    mockGenerateRegistrationOptions(...args),
  verifyRegistrationResponse: (...args: unknown[]) =>
    mockVerifyRegistrationResponse(...args),
  generateAuthenticationOptions: (...args: unknown[]) =>
    mockGenerateAuthenticationOptions(...args),
  verifyAuthenticationResponse: (...args: unknown[]) =>
    mockVerifyAuthenticationResponse(...args),
}));

vi.mock("@simplewebauthn/server/helpers", () => ({
  isoBase64URL: {
    toBuffer: (str: string) => Buffer.from(str, "base64url"),
    fromBuffer: (buf: Buffer | Uint8Array) =>
      Buffer.from(buf).toString("base64url"),
  },
}));

// セッションヘルパー
const authenticatedSession = {
  user: {
    accountId: "account-1",
    email: "test@example.com",
  },
};

// credential テストデータ
const validRegistrationCredential = {
  id: "credential-id-base64",
  rawId: "raw-id-base64",
  response: { attestationObject: "abc", clientDataJSON: "def" },
  type: "public-key" as const,
};

const validAuthCredential = {
  id: "credential-id-base64",
  rawId: "raw-id-base64",
  response: {
    authenticatorData: "auth-data",
    clientDataJSON: "client-data",
    signature: "sig",
    userHandle: "webauthn-user-1",
  },
  type: "public-key" as const,
};

describe("パスキーAPI - 結合テスト", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // GET /api/auth/passkey
  // =========================================================================
  describe("GET /api/auth/passkey - パスキー一覧取得", () => {
    describe("正常系", () => {
      it("登録済みパスキーの一覧を返す", async () => {
        mockGetServerSession.mockResolvedValue(authenticatedSession);
        mockPrisma.passkey.findMany.mockResolvedValue([
          {
            id: "pk-1",
            deviceName: "MacBook Pro",
            createdAt: new Date("2025-01-01"),
            lastUsedAt: new Date("2025-01-15"),
          },
        ]);

        const { GET } = await import("../route");
        const request = new NextRequest("http://localhost/api/auth/passkey");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.passkeys).toHaveLength(1);
        expect(data.passkeys[0].deviceName).toBe("MacBook Pro");
      });

      it("パスキーが0件の場合、空配列を返す", async () => {
        mockGetServerSession.mockResolvedValue(authenticatedSession);
        mockPrisma.passkey.findMany.mockResolvedValue([]);

        const { GET } = await import("../route");
        const request = new NextRequest("http://localhost/api/auth/passkey");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.passkeys).toHaveLength(0);
      });
    });

    describe("異常系", () => {
      it("未認証の場合、401を返す", async () => {
        mockGetServerSession.mockResolvedValue(null);

        const { GET } = await import("../route");
        const request = new NextRequest("http://localhost/api/auth/passkey");
        const response = await GET(request);

        expect(response.status).toBe(401);
      });
    });
  });

  // =========================================================================
  // DELETE /api/auth/passkey/[passkeyId]
  // =========================================================================
  describe("DELETE /api/auth/passkey/[passkeyId] - パスキー削除", () => {
    describe("正常系", () => {
      it("自分のパスキーを削除できる", async () => {
        mockGetServerSession.mockResolvedValue(authenticatedSession);
        mockPrisma.passkey.findUnique.mockResolvedValue({
          id: "pk-1",
          accountId: "account-1",
        });
        mockPrisma.passkey.delete.mockResolvedValue({});

        const { DELETE } = await import("../[passkeyId]/route");
        const request = new NextRequest(
          "http://localhost/api/auth/passkey/pk-1",
          { method: "DELETE" },
        );
        const response = await DELETE(request, {
          params: Promise.resolve({ passkeyId: "pk-1" }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.deleted).toBe(true);
      });
    });

    describe("異常系", () => {
      it("他ユーザーのパスキーを削除しようとすると403を返す", async () => {
        mockGetServerSession.mockResolvedValue(authenticatedSession);
        mockPrisma.passkey.findUnique.mockResolvedValue({
          id: "pk-2",
          accountId: "other-account",
        });

        const { DELETE } = await import("../[passkeyId]/route");
        const request = new NextRequest(
          "http://localhost/api/auth/passkey/pk-2",
          { method: "DELETE" },
        );
        const response = await DELETE(request, {
          params: Promise.resolve({ passkeyId: "pk-2" }),
        });

        expect(response.status).toBe(403);
      });

      it("存在しないパスキーを削除しようとすると404を返す", async () => {
        mockGetServerSession.mockResolvedValue(authenticatedSession);
        mockPrisma.passkey.findUnique.mockResolvedValue(null);

        const { DELETE } = await import("../[passkeyId]/route");
        const request = new NextRequest(
          "http://localhost/api/auth/passkey/pk-999",
          { method: "DELETE" },
        );
        const response = await DELETE(request, {
          params: Promise.resolve({ passkeyId: "pk-999" }),
        });

        expect(response.status).toBe(404);
      });

      it("未認証の場合、401を返す", async () => {
        mockGetServerSession.mockResolvedValue(null);

        const { DELETE } = await import("../[passkeyId]/route");
        const request = new NextRequest(
          "http://localhost/api/auth/passkey/pk-1",
          { method: "DELETE" },
        );
        const response = await DELETE(request, {
          params: Promise.resolve({ passkeyId: "pk-1" }),
        });

        expect(response.status).toBe(401);
      });
    });
  });

  // =========================================================================
  // POST /api/auth/passkey/register/options
  // =========================================================================
  describe("POST register/options - 登録オプション生成", () => {
    describe("正常系", () => {
      it("登録オプションを生成してCookieにチャレンジIDを設定する", async () => {
        mockGetServerSession.mockResolvedValue(authenticatedSession);
        mockPrisma.account.findUniqueOrThrow.mockResolvedValue({
          id: "account-1",
          email: "test@example.com",
          webauthnUserId: "webauthn-user-1",
          passkeys: [],
        });
        mockPrisma.webAuthnChallenge.deleteMany.mockResolvedValue({});
        mockPrisma.webAuthnChallenge.create.mockResolvedValue({
          id: "challenge-1",
        });
        mockGenerateRegistrationOptions.mockResolvedValue({
          challenge: "random-challenge",
          rp: { name: "MeTalk", id: "localhost" },
        });

        const { POST } = await import("../register/options/route");
        const request = new NextRequest(
          "http://localhost/api/auth/passkey/register/options",
          { method: "POST" },
        );
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.challenge).toBe("random-challenge");
        expect(response.headers.get("Set-Cookie")).toContain(
          "webauthn_reg_challenge=challenge-1",
        );
      });

      it("webauthnUserIdがない場合、生成してAccountに保存する", async () => {
        mockGetServerSession.mockResolvedValue(authenticatedSession);
        mockPrisma.account.findUniqueOrThrow.mockResolvedValue({
          id: "account-1",
          email: "test@example.com",
          webauthnUserId: null,
          passkeys: [],
        });
        mockPrisma.account.update.mockResolvedValue({});
        mockPrisma.webAuthnChallenge.deleteMany.mockResolvedValue({});
        mockPrisma.webAuthnChallenge.create.mockResolvedValue({
          id: "challenge-1",
        });
        mockGenerateRegistrationOptions.mockResolvedValue({
          challenge: "random-challenge",
        });

        const { POST } = await import("../register/options/route");
        const request = new NextRequest(
          "http://localhost/api/auth/passkey/register/options",
          { method: "POST" },
        );
        const response = await POST(request);

        expect(response.status).toBe(200);
        expect(mockPrisma.account.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: "account-1" },
            data: { webauthnUserId: expect.any(String) },
          }),
        );
      });
    });

    describe("異常系", () => {
      it("パスキー登録上限（20件）に達している場合、409を返す", async () => {
        mockGetServerSession.mockResolvedValue(authenticatedSession);
        mockPrisma.account.findUniqueOrThrow.mockResolvedValue({
          id: "account-1",
          email: "test@example.com",
          webauthnUserId: "webauthn-user-1",
          passkeys: Array(20).fill({ id: "pk" }),
        });

        const { POST } = await import("../register/options/route");
        const request = new NextRequest(
          "http://localhost/api/auth/passkey/register/options",
          { method: "POST" },
        );
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(409);
        expect(data.error).toContain("上限");
      });

      it("未認証の場合、401を返す", async () => {
        mockGetServerSession.mockResolvedValue(null);

        const { POST } = await import("../register/options/route");
        const request = new NextRequest(
          "http://localhost/api/auth/passkey/register/options",
          { method: "POST" },
        );
        const response = await POST(request);

        expect(response.status).toBe(401);
      });
    });
  });

  // =========================================================================
  // POST /api/auth/passkey/register/verify
  // =========================================================================
  describe("POST register/verify - 登録検証", () => {
    describe("正常系", () => {
      it("パスキーを登録できる", async () => {
        mockGetServerSession.mockResolvedValue(authenticatedSession);
        mockCookieStore.get.mockReturnValue({ value: "challenge-1" });
        mockPrisma.webAuthnChallenge.delete.mockResolvedValue({
          id: "challenge-1",
          challenge: "expected-challenge",
          type: "registration",
          accountId: "account-1",
        });
        mockVerifyRegistrationResponse.mockResolvedValue({
          verified: true,
          registrationInfo: {
            credential: {
              id: "cred-id-bytes",
              publicKey: new Uint8Array([1, 2, 3]),
              counter: 0,
              transports: ["internal"],
            },
            credentialDeviceType: "singleDevice",
            credentialBackedUp: false,
          },
        });
        mockPrisma.passkey.create.mockResolvedValue({});

        const { POST } = await import("../register/verify/route");
        const request = new NextRequest(
          "http://localhost/api/auth/passkey/register/verify",
          {
            method: "POST",
            body: JSON.stringify({
              credential: validRegistrationCredential,
              deviceName: "My Device",
            }),
          },
        );
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.verified).toBe(true);
        expect(mockPrisma.passkey.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              accountId: "account-1",
              deviceName: "My Device",
            }),
          }),
        );
      });
    });

    describe("異常系", () => {
      it("Cookieにチャレンジが存在しない場合、400を返す", async () => {
        mockGetServerSession.mockResolvedValue(authenticatedSession);
        mockCookieStore.get.mockReturnValue(undefined);

        const { POST } = await import("../register/verify/route");
        const request = new NextRequest(
          "http://localhost/api/auth/passkey/register/verify",
          {
            method: "POST",
            body: JSON.stringify({
              credential: validRegistrationCredential,
            }),
          },
        );
        const response = await POST(request);

        expect(response.status).toBe(400);
      });

      it("チャレンジが期限切れ・消費済みの場合、404を返す", async () => {
        mockGetServerSession.mockResolvedValue(authenticatedSession);
        mockCookieStore.get.mockReturnValue({ value: "expired-challenge" });
        mockPrisma.webAuthnChallenge.delete.mockRejectedValue(
          new Error("Not found"),
        );

        const { POST } = await import("../register/verify/route");
        const request = new NextRequest(
          "http://localhost/api/auth/passkey/register/verify",
          {
            method: "POST",
            body: JSON.stringify({
              credential: validRegistrationCredential,
            }),
          },
        );
        const response = await POST(request);

        expect(response.status).toBe(404);
      });

      it("WebAuthn検証に失敗した場合、400を返す", async () => {
        mockGetServerSession.mockResolvedValue(authenticatedSession);
        mockCookieStore.get.mockReturnValue({ value: "challenge-1" });
        mockPrisma.webAuthnChallenge.delete.mockResolvedValue({
          id: "challenge-1",
          challenge: "expected-challenge",
          type: "registration",
          accountId: "account-1",
        });
        mockVerifyRegistrationResponse.mockRejectedValue(
          new Error("Verification failed"),
        );

        const { POST } = await import("../register/verify/route");
        const request = new NextRequest(
          "http://localhost/api/auth/passkey/register/verify",
          {
            method: "POST",
            body: JSON.stringify({
              credential: validRegistrationCredential,
            }),
          },
        );
        const response = await POST(request);

        expect(response.status).toBe(400);
      });

      it("未認証の場合、401を返す", async () => {
        mockGetServerSession.mockResolvedValue(null);

        const { POST } = await import("../register/verify/route");
        const request = new NextRequest(
          "http://localhost/api/auth/passkey/register/verify",
          {
            method: "POST",
            body: JSON.stringify({
              credential: validRegistrationCredential,
            }),
          },
        );
        const response = await POST(request);

        expect(response.status).toBe(401);
      });
    });
  });

  // =========================================================================
  // POST /api/auth/passkey/authenticate/options
  // =========================================================================
  describe("POST authenticate/options - 認証オプション生成", () => {
    describe("正常系", () => {
      it("認証オプションを生成してCookieにチャレンジIDを設定する", async () => {
        mockPrisma.webAuthnChallenge.deleteMany.mockResolvedValue({});
        mockGenerateAuthenticationOptions.mockResolvedValue({
          challenge: "auth-challenge",
          rpId: "localhost",
        });
        mockPrisma.webAuthnChallenge.create.mockResolvedValue({
          id: "auth-challenge-1",
        });

        const { POST } = await import("../authenticate/options/route");
        const request = new NextRequest(
          "http://localhost/api/auth/passkey/authenticate/options",
          { method: "POST" },
        );
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.challenge).toBe("auth-challenge");
        expect(response.headers.get("Set-Cookie")).toContain(
          "webauthn_challenge=auth-challenge-1",
        );
      });
    });
  });

  // =========================================================================
  // POST /api/auth/passkey/authenticate/verify
  // =========================================================================
  describe("POST authenticate/verify - 認証検証", () => {
    function setupAuthVerifyMocks(overrides?: {
      newCounter?: number;
      storedCounter?: number;
    }) {
      const storedCounter = overrides?.storedCounter ?? 5;
      const newCounter = overrides?.newCounter ?? storedCounter + 1;

      mockCookieStore.get.mockReturnValue({ value: "auth-challenge-1" });
      mockPrisma.webAuthnChallenge.delete.mockResolvedValue({
        id: "auth-challenge-1",
        challenge: "expected-auth-challenge",
        type: "authentication",
      });
      mockPrisma.account.findUnique.mockResolvedValue({
        id: "account-1",
        webauthnUserId: "webauthn-user-1",
      });
      mockPrisma.passkey.findUnique.mockResolvedValue({
        id: "pk-1",
        accountId: "account-1",
        credentialId: Buffer.from("credential-id-base64", "base64url"),
        credentialPublicKey: Buffer.from([1, 2, 3]),
        counter: storedCounter,
        transports: ["internal"],
      });
      mockVerifyAuthenticationResponse.mockResolvedValue({
        verified: true,
        authenticationInfo: { newCounter },
      });
      mockPrisma.passkey.update.mockResolvedValue({});
      mockPrisma.webAuthnChallenge.create.mockResolvedValue({});
    }

    describe("正常系", () => {
      it("パスキーで認証できる", async () => {
        setupAuthVerifyMocks();

        const { POST } = await import("../authenticate/verify/route");
        const request = new NextRequest(
          "http://localhost/api/auth/passkey/authenticate/verify",
          {
            method: "POST",
            body: JSON.stringify({ credential: validAuthCredential }),
          },
        );
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.verified).toBe(true);
        // ログイントークンCookieが設定されている
        const setCookieHeader = response.headers.get("Set-Cookie");
        expect(setCookieHeader).toContain("passkey_token=");
      });

      it("カウンターが0→0の場合（カウンター非対応認証器）、認証を許可する", async () => {
        setupAuthVerifyMocks({ storedCounter: 0, newCounter: 0 });

        const { POST } = await import("../authenticate/verify/route");
        const request = new NextRequest(
          "http://localhost/api/auth/passkey/authenticate/verify",
          {
            method: "POST",
            body: JSON.stringify({ credential: validAuthCredential }),
          },
        );
        const response = await POST(request);

        expect(response.status).toBe(200);
      });
    });

    describe("異常系", () => {
      it("Cookieにチャレンジが存在しない場合、400を返す", async () => {
        mockCookieStore.get.mockReturnValue(undefined);

        const { POST } = await import("../authenticate/verify/route");
        const request = new NextRequest(
          "http://localhost/api/auth/passkey/authenticate/verify",
          {
            method: "POST",
            body: JSON.stringify({ credential: validAuthCredential }),
          },
        );
        const response = await POST(request);

        expect(response.status).toBe(400);
      });

      it("チャレンジが期限切れ・消費済みの場合、404を返す", async () => {
        mockCookieStore.get.mockReturnValue({ value: "expired-challenge" });
        mockPrisma.webAuthnChallenge.delete.mockRejectedValue(
          new Error("Not found"),
        );

        const { POST } = await import("../authenticate/verify/route");
        const request = new NextRequest(
          "http://localhost/api/auth/passkey/authenticate/verify",
          {
            method: "POST",
            body: JSON.stringify({ credential: validAuthCredential }),
          },
        );
        const response = await POST(request);

        expect(response.status).toBe(404);
      });

      it("カウンターが減少している場合（クローン攻撃）、400を返す", async () => {
        setupAuthVerifyMocks({ storedCounter: 10, newCounter: 5 });

        const { POST } = await import("../authenticate/verify/route");
        const request = new NextRequest(
          "http://localhost/api/auth/passkey/authenticate/verify",
          {
            method: "POST",
            body: JSON.stringify({ credential: validAuthCredential }),
          },
        );
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain("整合性エラー");
      });

      it("カウンターが同じ値の場合（リプレイ攻撃）、400を返す", async () => {
        setupAuthVerifyMocks({ storedCounter: 10, newCounter: 10 });

        const { POST } = await import("../authenticate/verify/route");
        const request = new NextRequest(
          "http://localhost/api/auth/passkey/authenticate/verify",
          {
            method: "POST",
            body: JSON.stringify({ credential: validAuthCredential }),
          },
        );
        const response = await POST(request);

        expect(response.status).toBe(400);
      });

      it("WebAuthn検証に失敗した場合、400を返す", async () => {
        mockCookieStore.get.mockReturnValue({ value: "auth-challenge-1" });
        mockPrisma.webAuthnChallenge.delete.mockResolvedValue({
          id: "auth-challenge-1",
          challenge: "expected-auth-challenge",
          type: "authentication",
        });
        mockPrisma.account.findUnique.mockResolvedValue({
          id: "account-1",
          webauthnUserId: "webauthn-user-1",
        });
        mockPrisma.passkey.findUnique.mockResolvedValue({
          id: "pk-1",
          accountId: "account-1",
          credentialId: Buffer.from("credential-id-base64", "base64url"),
          credentialPublicKey: Buffer.from([1, 2, 3]),
          counter: 5,
          transports: ["internal"],
        });
        mockVerifyAuthenticationResponse.mockRejectedValue(
          new Error("Verification failed"),
        );

        const { POST } = await import("../authenticate/verify/route");
        const request = new NextRequest(
          "http://localhost/api/auth/passkey/authenticate/verify",
          {
            method: "POST",
            body: JSON.stringify({ credential: validAuthCredential }),
          },
        );
        const response = await POST(request);

        expect(response.status).toBe(400);
      });

      it("アカウントが見つからない場合、404を返す", async () => {
        mockCookieStore.get.mockReturnValue({ value: "auth-challenge-1" });
        mockPrisma.webAuthnChallenge.delete.mockResolvedValue({
          id: "auth-challenge-1",
          challenge: "expected-auth-challenge",
          type: "authentication",
        });
        mockPrisma.account.findUnique.mockResolvedValue(null);

        const { POST } = await import("../authenticate/verify/route");
        const request = new NextRequest(
          "http://localhost/api/auth/passkey/authenticate/verify",
          {
            method: "POST",
            body: JSON.stringify({ credential: validAuthCredential }),
          },
        );
        const response = await POST(request);

        expect(response.status).toBe(404);
      });

      it("パスキーが見つからない場合、404を返す", async () => {
        mockCookieStore.get.mockReturnValue({ value: "auth-challenge-1" });
        mockPrisma.webAuthnChallenge.delete.mockResolvedValue({
          id: "auth-challenge-1",
          challenge: "expected-auth-challenge",
          type: "authentication",
        });
        mockPrisma.account.findUnique.mockResolvedValue({
          id: "account-1",
          webauthnUserId: "webauthn-user-1",
        });
        mockPrisma.passkey.findUnique.mockResolvedValue(null);

        const { POST } = await import("../authenticate/verify/route");
        const request = new NextRequest(
          "http://localhost/api/auth/passkey/authenticate/verify",
          {
            method: "POST",
            body: JSON.stringify({ credential: validAuthCredential }),
          },
        );
        const response = await POST(request);

        expect(response.status).toBe(404);
      });
    });
  });
});
