import { describe, expect, it } from "vitest";
import {
  detectContentType,
  sanitizeFileName,
  validateMagicBytes,
} from "../avatar-utils";

describe("validateMagicBytes", () => {
  it("JPEGファイルを正しく検証する", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    expect(validateMagicBytes(jpeg)).toBe(true);
  });

  it("PNGファイルを正しく検証する", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d]);
    expect(validateMagicBytes(png)).toBe(true);
  });

  it("GIFファイルを正しく検証する", () => {
    const gif = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39]);
    expect(validateMagicBytes(gif)).toBe(true);
  });

  it("WebPファイルを正しく検証する", () => {
    // RIFF....WEBP
    const webp = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    expect(validateMagicBytes(webp)).toBe(true);
  });

  it("RIFFヘッダーのみでWEBPシグネチャがない場合はfalseを返す", () => {
    const riffOnly = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49, 0x20,
    ]);
    expect(validateMagicBytes(riffOnly)).toBe(false);
  });

  it("不正なバイナリを拒否する", () => {
    const invalid = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    expect(validateMagicBytes(invalid)).toBe(false);
  });

  it("空のバッファを拒否する", () => {
    expect(validateMagicBytes(Buffer.alloc(0))).toBe(false);
  });

  it("短すぎるバッファを拒否する", () => {
    expect(validateMagicBytes(Buffer.from([0xff, 0xd8]))).toBe(false);
  });
});

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

  it("不明な形式にはnullを返す", () => {
    const unknown = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    expect(detectContentType(unknown)).toBeNull();
  });

  it("空のバッファにはnullを返す", () => {
    expect(detectContentType(Buffer.alloc(0))).toBeNull();
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
});
