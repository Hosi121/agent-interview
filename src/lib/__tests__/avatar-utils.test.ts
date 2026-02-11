import { describe, expect, it, vi } from "vitest";
import {
  detectContentType,
  processImage,
  sanitizeFileName,
} from "../avatar-utils";

const mockToBuffer = vi.fn().mockResolvedValue(Buffer.from("processed"));
const mockGif = vi.fn().mockReturnValue({ toBuffer: mockToBuffer });
const mockJpeg = vi.fn().mockReturnValue({ toBuffer: mockToBuffer });
const mockPng = vi.fn().mockReturnValue({ toBuffer: mockToBuffer });
const mockWebp = vi.fn().mockReturnValue({ toBuffer: mockToBuffer });
const mockResize = vi
  .fn()
  .mockReturnValue({ jpeg: mockJpeg, png: mockPng, webp: mockWebp });
const mockRotate = vi.fn().mockReturnValue({ resize: mockResize });
const mockSharp = vi.fn().mockReturnValue({ rotate: mockRotate, gif: mockGif });

vi.mock("sharp", () => ({ default: mockSharp }));

describe("detectContentType", () => {
  it("JPEGのContent-Typeを返す", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    expect(detectContentType(jpeg)).toBe("image/jpeg");
  });

  it("PNGのContent-Typeを返す", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    expect(detectContentType(png)).toBe("image/png");
  });

  it("GIFのContent-Typeを返す", () => {
    const gif = Buffer.from([0x47, 0x49, 0x46, 0x38]);
    expect(detectContentType(gif)).toBe("image/gif");
  });

  it("WebPのContent-Typeを返す", () => {
    const webp = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    expect(detectContentType(webp)).toBe("image/webp");
  });

  it("RIFFヘッダーのみでWEBPシグネチャがない場合はnullを返す", () => {
    const riffOnly = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49, 0x20,
    ]);
    expect(detectContentType(riffOnly)).toBeNull();
  });

  it("不明な形式にはnullを返す", () => {
    const unknown = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    expect(detectContentType(unknown)).toBeNull();
  });

  it("空のバッファにはnullを返す", () => {
    expect(detectContentType(Buffer.alloc(0))).toBeNull();
  });

  it("短すぎるバッファにはnullを返す", () => {
    expect(detectContentType(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});

describe("sanitizeFileName", () => {
  it("危険な文字を置換する", () => {
    expect(sanitizeFileName("file/name\\test?file")).toBe(
      "file-name-test-file",
    );
    expect(sanitizeFileName('name*:name|"<>')).toBe("name--name----");
  });

  it("連続ドットを単一にする", () => {
    expect(sanitizeFileName("file...name..txt")).toBe("file.name.txt");
  });

  it("NULバイトを除去する", () => {
    expect(sanitizeFileName("file\0name.jpg")).toBe("filename.jpg");
  });

  it("255文字に切り詰める", () => {
    const long = "a".repeat(300);
    expect(sanitizeFileName(long)).toHaveLength(255);
  });

  it("通常のファイル名はそのまま返す", () => {
    expect(sanitizeFileName("photo.jpg")).toBe("photo.jpg");
    expect(sanitizeFileName("my-avatar_2024.png")).toBe("my-avatar_2024.png");
  });

  it("空文字列になる場合はフォールバックする", () => {
    expect(sanitizeFileName("\0\0\0")).toBe("avatar");
    expect(sanitizeFileName("")).toBe("avatar");
  });
});

describe("processImage", () => {
  it("GIFはリサイズせずメタデータ除去のみ行う", async () => {
    const gif = Buffer.from("gif-data");
    const result = await processImage(gif, "image/gif");

    expect(mockSharp).toHaveBeenCalledWith(gif, { animated: true });
    expect(mockGif).toHaveBeenCalled();
    expect(mockRotate).not.toHaveBeenCalled();
    expect(mockResize).not.toHaveBeenCalled();
    expect(result).toEqual(Buffer.from("processed"));
  });

  it("JPEGのメタデータを除去しリサイズする", async () => {
    const input = Buffer.from("jpeg-data");
    const result = await processImage(input, "image/jpeg");

    expect(mockSharp).toHaveBeenCalledWith(input);
    expect(mockRotate).toHaveBeenCalled();
    expect(mockResize).toHaveBeenCalledWith(512, 512, {
      fit: "cover",
      withoutEnlargement: true,
    });
    expect(mockJpeg).toHaveBeenCalled();
    expect(result).toEqual(Buffer.from("processed"));
  });

  it("PNGのメタデータを除去しリサイズする", async () => {
    await processImage(Buffer.from("png-data"), "image/png");
    expect(mockResize).toHaveBeenCalled();
    expect(mockPng).toHaveBeenCalled();
  });

  it("WebPのメタデータを除去しリサイズする", async () => {
    await processImage(Buffer.from("webp-data"), "image/webp");
    expect(mockResize).toHaveBeenCalled();
    expect(mockWebp).toHaveBeenCalled();
  });

  it("不明なContent-Typeはそのまま返す", async () => {
    const input = Buffer.from("unknown");
    const result = await processImage(input, "image/bmp");
    expect(result).toBe(input);
  });

  it("sharpが失敗した場合はValidationErrorをスローする", async () => {
    mockRotate.mockReturnValueOnce({
      resize: vi.fn().mockReturnValue({
        jpeg: vi.fn().mockReturnValue({
          toBuffer: vi.fn().mockRejectedValue(new Error("corrupt")),
        }),
      }),
    });

    await expect(
      processImage(Buffer.from("bad"), "image/jpeg"),
    ).rejects.toThrow("画像の処理に失敗しました");
  });
});
