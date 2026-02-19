import { describe, expect, it, vi } from "vitest";
import {
  deleteFragmentWithRelations,
  parseFragmentType,
  qualityToConfidence,
  UUID_REGEX,
} from "../fragment-utils";

describe("fragment-utils", () => {
  describe("UUID_REGEX", () => {
    it("有効なUUID v4を受け入れる", () => {
      expect(UUID_REGEX.test("11111111-1111-1111-1111-111111111111")).toBe(
        true,
      );
      expect(UUID_REGEX.test("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe(
        true,
      );
    });

    it("大文字のUUIDも受け入れる", () => {
      expect(UUID_REGEX.test("ABCDEF12-3456-7890-ABCD-EF1234567890")).toBe(
        true,
      );
    });

    it("無効な形式を拒否する", () => {
      expect(UUID_REGEX.test("invalid")).toBe(false);
      expect(UUID_REGEX.test("")).toBe(false);
      expect(UUID_REGEX.test("11111111-1111-1111-1111")).toBe(false);
      expect(UUID_REGEX.test("11111111111111111111111111111111")).toBe(false);
    });
  });

  describe("qualityToConfidence", () => {
    it("low → 0.4", () => {
      expect(qualityToConfidence.low).toBe(0.4);
    });

    it("medium → 0.7", () => {
      expect(qualityToConfidence.medium).toBe(0.7);
    });

    it("high → 1.0", () => {
      expect(qualityToConfidence.high).toBe(1.0);
    });
  });

  describe("parseFragmentType", () => {
    it("有効なFragmentTypeを返す", () => {
      expect(parseFragmentType("FACT")).toBe("FACT");
      expect(parseFragmentType("ACHIEVEMENT")).toBe("ACHIEVEMENT");
      expect(parseFragmentType("SKILL_USAGE")).toBe("SKILL_USAGE");
      expect(parseFragmentType("ACTION")).toBe("ACTION");
      expect(parseFragmentType("CHALLENGE")).toBe("CHALLENGE");
      expect(parseFragmentType("LEARNING")).toBe("LEARNING");
      expect(parseFragmentType("VALUE")).toBe("VALUE");
      expect(parseFragmentType("EMOTION")).toBe("EMOTION");
    });

    it("無効な値はFACTにフォールバックする", () => {
      expect(parseFragmentType("INVALID")).toBe("FACT");
      expect(parseFragmentType("")).toBe("FACT");
      expect(parseFragmentType(undefined)).toBe("FACT");
    });
  });

  describe("deleteFragmentWithRelations", () => {
    it("正しい順序で関連レコードとフラグメントを削除する", async () => {
      const callOrder: string[] = [];
      const tx = {
        messageReference: {
          deleteMany: vi.fn().mockImplementation(() => {
            callOrder.push("messageReference.deleteMany");
          }),
        },
        tagging: {
          deleteMany: vi.fn().mockImplementation(() => {
            callOrder.push("tagging.deleteMany");
          }),
        },
        fragment: {
          updateMany: vi.fn().mockImplementation(() => {
            callOrder.push("fragment.updateMany");
          }),
          delete: vi.fn().mockImplementation(() => {
            callOrder.push("fragment.delete");
          }),
        },
      };

      await deleteFragmentWithRelations(
        tx as unknown as Parameters<typeof deleteFragmentWithRelations>[0],
        "test-fragment-id",
      );

      expect(tx.messageReference.deleteMany).toHaveBeenCalledWith({
        where: { refType: "FRAGMENT", refId: "test-fragment-id" },
      });
      expect(tx.tagging.deleteMany).toHaveBeenCalledWith({
        where: { taggableType: "FRAGMENT", taggableId: "test-fragment-id" },
      });
      expect(tx.fragment.updateMany).toHaveBeenCalledWith({
        where: { parentId: "test-fragment-id" },
        data: { parentId: null },
      });
      expect(tx.fragment.delete).toHaveBeenCalledWith({
        where: { id: "test-fragment-id" },
      });

      // 削除順序の検証: 関連レコード → 子の親参照解除 → 本体削除
      expect(callOrder).toEqual([
        "messageReference.deleteMany",
        "tagging.deleteMany",
        "fragment.updateMany",
        "fragment.delete",
      ]);
    });
  });
});
