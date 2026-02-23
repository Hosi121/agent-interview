import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────

const mockGetServerSession = vi.fn();
vi.mock("next-auth", () => ({
  getServerSession: () => mockGetServerSession(),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
vi.mock("@/lib/logger", () => ({ logger: mockLogger }));

const mockPrisma = {
  passkey: {
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ── Constants ──────────────────────────────────────────────────────

const ACCOUNT_ID = "acc-001";
const PASSKEY_ID = "550e8400-e29b-41d4-a716-446655440000"; // valid UUID
const OTHER_ACCOUNT_ID = "acc-999";

const authenticatedSession = {
  user: {
    accountId: ACCOUNT_ID,
    accountType: "USER",
  },
};

const mockPasskey = {
  id: PASSKEY_ID,
  accountId: ACCOUNT_ID,
  credentialId: "cred-123",
  publicKey: Buffer.from("key"),
  counter: 0,
  transports: ["usb"],
  deviceName: "YubiKey",
  createdAt: new Date(),
};

const routeContext = {
  params: Promise.resolve({ passkeyId: PASSKEY_ID }),
};

// ── Helpers ────────────────────────────────────────────────────────

function createDeleteRequest(): NextRequest {
  return new NextRequest(`http://localhost/api/auth/passkey/${PASSKEY_ID}`, {
    method: "DELETE",
  });
}

// ── Tests ──────────────────────────────────────────────────────────

describe("DELETE /api/auth/passkey/[passkeyId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(authenticatedSession);
    mockPrisma.passkey.findUnique.mockResolvedValue(mockPasskey);
    mockPrisma.passkey.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("自分のパスキーを削除できる", async () => {
    const { DELETE } = await import("@/app/api/auth/passkey/[passkeyId]/route");
    const response = await DELETE(createDeleteRequest(), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.deleted).toBe(true);
  });

  it("accountId条件付きdeleteMany で所有権を検証する（TOCTOU防止）", async () => {
    const { DELETE } = await import("@/app/api/auth/passkey/[passkeyId]/route");
    await DELETE(createDeleteRequest(), routeContext);

    expect(mockPrisma.passkey.deleteMany).toHaveBeenCalledWith({
      where: { id: PASSKEY_ID, accountId: ACCOUNT_ID },
    });
  });

  it("同時リクエストで既に削除済みなら404を返す", async () => {
    mockPrisma.passkey.deleteMany.mockResolvedValue({ count: 0 });

    const { DELETE } = await import("@/app/api/auth/passkey/[passkeyId]/route");
    const response = await DELETE(createDeleteRequest(), routeContext);

    expect(response.status).toBe(404);
  });

  it("存在しないパスキーは404を返す", async () => {
    mockPrisma.passkey.findUnique.mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/auth/passkey/[passkeyId]/route");
    const response = await DELETE(createDeleteRequest(), routeContext);

    expect(response.status).toBe(404);
    expect(mockPrisma.passkey.deleteMany).not.toHaveBeenCalled();
  });

  it("他ユーザーのパスキーは403を返す", async () => {
    mockPrisma.passkey.findUnique.mockResolvedValue({
      ...mockPasskey,
      accountId: OTHER_ACCOUNT_ID,
    });

    const { DELETE } = await import("@/app/api/auth/passkey/[passkeyId]/route");
    const response = await DELETE(createDeleteRequest(), routeContext);

    expect(response.status).toBe(403);
    expect(mockPrisma.passkey.deleteMany).not.toHaveBeenCalled();
  });

  it("未認証の場合401を返す", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/auth/passkey/[passkeyId]/route");
    const response = await DELETE(createDeleteRequest(), routeContext);

    expect(response.status).toBe(401);
  });

  it("accountIdがない場合401を返す", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { accountType: "USER" },
    });

    const { DELETE } = await import("@/app/api/auth/passkey/[passkeyId]/route");
    const response = await DELETE(createDeleteRequest(), routeContext);

    expect(response.status).toBe(401);
  });

  it("無効なUUID形式の場合400を返す", async () => {
    const invalidContext = {
      params: Promise.resolve({ passkeyId: "not-a-uuid" }),
    };

    const { DELETE } = await import("@/app/api/auth/passkey/[passkeyId]/route");
    const response = await DELETE(createDeleteRequest(), invalidContext);

    expect(response.status).toBe(400);
    expect(mockPrisma.passkey.findUnique).not.toHaveBeenCalled();
  });

  it("正しいIDでfindUniqueを呼ぶ", async () => {
    const { DELETE } = await import("@/app/api/auth/passkey/[passkeyId]/route");
    await DELETE(createDeleteRequest(), routeContext);

    expect(mockPrisma.passkey.findUnique).toHaveBeenCalledWith({
      where: { id: PASSKEY_ID },
    });
  });
});
