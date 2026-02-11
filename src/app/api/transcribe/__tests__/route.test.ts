import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// NextAuthのモック
const mockGetServerSession = vi.fn();
vi.mock("next-auth", () => ({
  getServerSession: () => mockGetServerSession(),
}));

// authOptionsのモック
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

// OpenAIのモック
const mockCreate = vi.hoisted(() => vi.fn());
vi.mock("openai", () => ({
  default: class MockOpenAI {
    audio = {
      transcriptions: {
        create: mockCreate,
      },
    };
  },
}));

import { POST } from "../route";

function createRequestWithFormData(fileOrNull: File | null): NextRequest {
  const req = new NextRequest("http://localhost/api/transcribe", {
    method: "POST",
  });

  // formData()をモックして直接結果を返す
  const formData = new FormData();
  if (fileOrNull) {
    formData.append("file", fileOrNull);
  }
  vi.spyOn(req, "formData").mockResolvedValue(formData);

  return req;
}

describe("POST /api/transcribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({
      user: { accountId: "acc-1", email: "test@example.com" },
    });
  });

  it("音声ファイルを文字起こしして結果を返す", async () => {
    mockCreate.mockResolvedValue({ text: "こんにちは" });

    const file = new File(["audio-data"], "test.webm", {
      type: "audio/webm",
    });
    const req = createRequestWithFormData(file);

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.text).toBe("こんにちは");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "whisper-1",
        language: "ja",
      }),
    );
  });

  it("ファイルがない場合400エラーを返す", async () => {
    const req = createRequestWithFormData(null);

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("音声ファイルが必要です");
  });

  it("音声以外のMIMEタイプは400エラーを返す", async () => {
    const file = new File(["data"], "test.txt", { type: "text/plain" });
    const req = createRequestWithFormData(file);

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("音声ファイルのみ対応しています");
  });

  it("未認証の場合401エラーを返す", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const file = new File(["audio-data"], "test.webm", {
      type: "audio/webm",
    });
    const req = createRequestWithFormData(file);

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.code).toBe("UNAUTHORIZED");
  });
});
