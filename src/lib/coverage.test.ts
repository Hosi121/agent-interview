/**
 * 網羅度計算 - 単体テスト
 *
 * ユーザーストーリー:
 * - 求職者として、チャット中に情報収集の進捗を確認したい
 * - 求職者として、80%達成時に「そろそろ終わりにできます」と案内されたい
 * - 求職者として、100%達成時に「完了しました」と案内されたい
 */

import { describe, expect, it } from "vitest";
import { COVERAGE_REQUIREMENTS, calculateCoverage } from "./coverage";

describe("網羅度計算 - 単体テスト", () => {
  describe("COVERAGE_REQUIREMENTS - 要件定義", () => {
    it("6つのカテゴリが定義されている", () => {
      expect(COVERAGE_REQUIREMENTS).toHaveLength(6);
    });

    it("全カテゴリの重みの合計が1.0（100%）になる", () => {
      const totalWeight = COVERAGE_REQUIREMENTS.reduce(
        (sum, req) => sum + req.weight,
        0,
      );
      expect(totalWeight).toBe(1.0);
    });

    it("ACHIEVEMENTは2件必要、重み25%", () => {
      const achievement = COVERAGE_REQUIREMENTS.find(
        (r) => r.category === "ACHIEVEMENT",
      );
      expect(achievement?.required).toBe(2);
      expect(achievement?.weight).toBe(0.25);
    });

    it("CHALLENGEは1件必要、重み20%", () => {
      const challenge = COVERAGE_REQUIREMENTS.find(
        (r) => r.category === "CHALLENGE",
      );
      expect(challenge?.required).toBe(1);
      expect(challenge?.weight).toBe(0.2);
    });

    it("SKILL_USAGEは2件必要、重み20%", () => {
      const skillUsage = COVERAGE_REQUIREMENTS.find(
        (r) => r.category === "SKILL_USAGE",
      );
      expect(skillUsage?.required).toBe(2);
      expect(skillUsage?.weight).toBe(0.2);
    });

    it("LEARNINGは1件必要、重み15%", () => {
      const learning = COVERAGE_REQUIREMENTS.find(
        (r) => r.category === "LEARNING",
      );
      expect(learning?.required).toBe(1);
      expect(learning?.weight).toBe(0.15);
    });

    it("FACTは1件必要、重み10%", () => {
      const fact = COVERAGE_REQUIREMENTS.find((r) => r.category === "FACT");
      expect(fact?.required).toBe(1);
      expect(fact?.weight).toBe(0.1);
    });

    it("VALUEは1件必要、重み10%", () => {
      const value = COVERAGE_REQUIREMENTS.find((r) => r.category === "VALUE");
      expect(value?.required).toBe(1);
      expect(value?.weight).toBe(0.1);
    });
  });

  describe("calculateCoverage - 網羅度計算", () => {
    describe("正常系: 空のフラグメント", () => {
      it("フラグメントがない場合、0%を返す", () => {
        const result = calculateCoverage([]);

        expect(result.percentage).toBe(0);
        expect(result.isReadyToFinish).toBe(false);
        expect(result.isComplete).toBe(false);
      });

      it("全カテゴリの進捗が0/requiredで返される", () => {
        const result = calculateCoverage([]);

        expect(result.categories).toHaveLength(6);
        result.categories.forEach((cat) => {
          expect(cat.current).toBe(0);
          expect(cat.fulfilled).toBe(false);
        });
      });
    });

    describe("正常系: 部分的な充足", () => {
      it("ACHIEVEMENTが1件の場合、12.5%（25% × 0.5）加算される", () => {
        const fragments = [{ type: "ACHIEVEMENT" }];
        const result = calculateCoverage(fragments);

        // ACHIEVEMENT: 1/2 = 50% × 0.25 = 12.5%
        expect(result.percentage).toBe(13); // 四捨五入
      });

      it("ACHIEVEMENTが2件で充足", () => {
        const fragments = [{ type: "ACHIEVEMENT" }, { type: "ACHIEVEMENT" }];
        const result = calculateCoverage(fragments);

        const achievement = result.categories.find(
          (c) => c.category === "ACHIEVEMENT",
        );
        expect(achievement?.current).toBe(2);
        expect(achievement?.fulfilled).toBe(true);
      });

      it("FACTが1件で充足（10%加算）", () => {
        const fragments = [{ type: "FACT" }];
        const result = calculateCoverage(fragments);

        const fact = result.categories.find((c) => c.category === "FACT");
        expect(fact?.fulfilled).toBe(true);
        expect(result.percentage).toBe(10);
      });
    });

    describe("正常系: 80%到達（isReadyToFinish）", () => {
      it("80%以上でisReadyToFinishがtrueになる", () => {
        // 80%を達成するフラグメント構成:
        // ACHIEVEMENT: 2件 (25%)
        // CHALLENGE: 1件 (20%)
        // SKILL_USAGE: 2件 (20%)
        // LEARNING: 1件 (15%)
        // = 80%
        const fragments = [
          { type: "ACHIEVEMENT" },
          { type: "ACHIEVEMENT" },
          { type: "CHALLENGE" },
          { type: "SKILL_USAGE" },
          { type: "SKILL_USAGE" },
          { type: "LEARNING" },
        ];
        const result = calculateCoverage(fragments);

        expect(result.percentage).toBe(80);
        expect(result.isReadyToFinish).toBe(true);
        expect(result.isComplete).toBe(false);
      });

      it("79%ではisReadyToFinishがfalse", () => {
        // 79%相当のフラグメント（LEARNINGを除く）
        const fragments = [
          { type: "ACHIEVEMENT" },
          { type: "ACHIEVEMENT" },
          { type: "CHALLENGE" },
          { type: "SKILL_USAGE" },
          { type: "SKILL_USAGE" },
          // LEARNINGなし = 65%
          { type: "FACT" }, // +10% = 75%
        ];
        const result = calculateCoverage(fragments);

        expect(result.percentage).toBeLessThan(80);
        expect(result.isReadyToFinish).toBe(false);
      });
    });

    describe("正常系: 100%到達（isComplete）", () => {
      it("全カテゴリ充足で100%、isCompleteがtrue", () => {
        const fragments = [
          { type: "ACHIEVEMENT" },
          { type: "ACHIEVEMENT" },
          { type: "CHALLENGE" },
          { type: "SKILL_USAGE" },
          { type: "SKILL_USAGE" },
          { type: "LEARNING" },
          { type: "FACT" },
          { type: "VALUE" },
        ];
        const result = calculateCoverage(fragments);

        expect(result.percentage).toBe(100);
        expect(result.isReadyToFinish).toBe(true);
        expect(result.isComplete).toBe(true);
      });

      it("全カテゴリがfulfilledになる", () => {
        const fragments = [
          { type: "ACHIEVEMENT" },
          { type: "ACHIEVEMENT" },
          { type: "CHALLENGE" },
          { type: "SKILL_USAGE" },
          { type: "SKILL_USAGE" },
          { type: "LEARNING" },
          { type: "FACT" },
          { type: "VALUE" },
        ];
        const result = calculateCoverage(fragments);

        result.categories.forEach((cat) => {
          expect(cat.fulfilled).toBe(true);
        });
      });
    });

    describe("正常系: 必要数を超えるフラグメント", () => {
      it("必要数を超えても100%より増えない", () => {
        const fragments = [
          { type: "ACHIEVEMENT" },
          { type: "ACHIEVEMENT" },
          { type: "ACHIEVEMENT" }, // 超過
          { type: "ACHIEVEMENT" }, // 超過
          { type: "CHALLENGE" },
          { type: "CHALLENGE" }, // 超過
          { type: "SKILL_USAGE" },
          { type: "SKILL_USAGE" },
          { type: "SKILL_USAGE" }, // 超過
          { type: "LEARNING" },
          { type: "FACT" },
          { type: "VALUE" },
        ];
        const result = calculateCoverage(fragments);

        expect(result.percentage).toBe(100);
      });

      it("currentは実際の件数を反映する", () => {
        const fragments = [
          { type: "ACHIEVEMENT" },
          { type: "ACHIEVEMENT" },
          { type: "ACHIEVEMENT" }, // 超過
        ];
        const result = calculateCoverage(fragments);

        const achievement = result.categories.find(
          (c) => c.category === "ACHIEVEMENT",
        );
        expect(achievement?.current).toBe(3);
        expect(achievement?.required).toBe(2);
      });
    });

    describe("エッジケース", () => {
      it("未知のカテゴリは無視される", () => {
        const fragments = [
          { type: "UNKNOWN_TYPE" },
          { type: "ANOTHER_UNKNOWN" },
        ];
        const result = calculateCoverage(fragments);

        expect(result.percentage).toBe(0);
      });

      it("カテゴリラベルが日本語で返される", () => {
        const result = calculateCoverage([]);

        const labels = result.categories.map((c) => c.label);
        expect(labels).toContain("成果・実績");
        expect(labels).toContain("困難克服経験");
        expect(labels).toContain("スキル使用例");
        expect(labels).toContain("学び・気づき");
        expect(labels).toContain("基本情報");
        expect(labels).toContain("価値観");
      });
    });
  });
});
