/**
 * マッチングロジック 単体テスト
 *
 * エージェント公開時の自動マッチング、求人レコメンド、ウォッチ通知を支える
 * コアスコアリングロジックをテストする。
 */

import { describe, expect, it } from "vitest";
import {
  calculateExperienceMatch,
  calculateJobMatchScore,
  calculateKeywordMatch,
  calculateSkillMatch,
  calculateWatchMatchScore,
  extractSkillsAndKeywords,
} from "../matching";

// ── calculateSkillMatch ──────────────────────────────────

describe("calculateSkillMatch", () => {
  describe("完全一致", () => {
    it("全スキルが一致する場合1.0を返す", () => {
      expect(
        calculateSkillMatch(["React", "TypeScript"], ["React", "TypeScript"]),
      ).toBe(1.0);
    });

    it("大文字小文字を無視して一致する", () => {
      expect(
        calculateSkillMatch(["react", "TYPESCRIPT"], ["React", "TypeScript"]),
      ).toBe(1.0);
    });
  });

  describe("部分一致", () => {
    it("求人スキルが候補スキルの部分文字列の場合に一致する", () => {
      // "react" は "react.js" に含まれる
      expect(calculateSkillMatch(["React"], ["React.js"])).toBe(1.0);
    });

    it("候補スキルが求人スキルの部分文字列の場合に一致する", () => {
      // "node" は "node.js" に含まれる（逆方向: 求人スキルが候補スキルを含む）
      expect(calculateSkillMatch(["Node.js"], ["Node"])).toBe(1.0);
    });

    it("一部のみ一致する場合は比率を返す", () => {
      const score = calculateSkillMatch(["React", "Vue", "Angular"], ["React"]);
      expect(score).toBeCloseTo(1 / 3);
    });
  });

  describe("不一致", () => {
    it("一致するスキルがない場合0を返す", () => {
      expect(
        calculateSkillMatch(["Python", "Go"], ["React", "TypeScript"]),
      ).toBe(0);
    });
  });

  describe("エッジケース", () => {
    it("求人スキルが空の場合1.0を返す（スキル要件なし）", () => {
      expect(calculateSkillMatch([], ["React", "TypeScript"])).toBe(1.0);
    });

    it("候補スキルが空の場合0を返す", () => {
      expect(calculateSkillMatch(["React"], [])).toBe(0);
    });

    it("両方空の場合1.0を返す", () => {
      expect(calculateSkillMatch([], [])).toBe(1.0);
    });

    it("重複スキルはSet化により正規化される", () => {
      const score = calculateSkillMatch(["React", "React", "Vue"], ["React"]);
      // Set化で ["React", "Vue"] → 1/2 一致
      expect(score).toBe(0.5);
    });
  });
});

// ── calculateKeywordMatch ──────────────────────────────────

describe("calculateKeywordMatch", () => {
  it("全キーワードが一致する場合1.0を返す", () => {
    expect(
      calculateKeywordMatch(
        ["フロントエンド", "バックエンド"],
        ["フロントエンド", "バックエンド"],
      ),
    ).toBe(1.0);
  });

  it("部分一致でマッチする", () => {
    // "フロント" は "フロントエンド" に含まれる
    expect(calculateKeywordMatch(["フロント"], ["フロントエンド"])).toBe(1.0);
  });

  it("一部のみ一致する場合は比率を返す", () => {
    const score = calculateKeywordMatch(
      ["機械学習", "データ分析", "NLP"],
      ["機械学習"],
    );
    expect(score).toBeCloseTo(1 / 3);
  });

  it("求人キーワードが空の場合1.0を返す", () => {
    expect(calculateKeywordMatch([], ["キーワード"])).toBe(1.0);
  });

  it("候補キーワードが空の場合0を返す", () => {
    expect(calculateKeywordMatch(["キーワード"], [])).toBe(0);
  });
});

// ── calculateExperienceMatch ──────────────────────────────────

describe("calculateExperienceMatch", () => {
  // ヘルパー: 指定タイプのフラグメントをN個生成
  function makeFragments(count: number, type = "FACT"): { type: string }[] {
    return Array.from({ length: count }, () => ({ type }));
  }

  describe("経験レベル推定ロジック", () => {
    it("フラグメント0件 → ENTRY相当（レベル0）", () => {
      // ENTRY要求 vs レベル0推定 → diff=0 → 1.0
      expect(calculateExperienceMatch("ENTRY", [])).toBe(1.0);
    });

    it("フラグメント3件 → JUNIOR相当（レベル1）", () => {
      expect(calculateExperienceMatch("JUNIOR", makeFragments(3))).toBe(1.0);
    });

    it("フラグメント6件 → MID相当（レベル2）", () => {
      expect(calculateExperienceMatch("MID", makeFragments(6))).toBe(1.0);
    });

    it("フラグメント10件 → SENIOR相当（レベル3）", () => {
      expect(calculateExperienceMatch("SENIOR", makeFragments(10))).toBe(1.0);
    });

    it("フラグメント15件以上 → LEAD相当（レベル4）", () => {
      expect(calculateExperienceMatch("LEAD", makeFragments(15))).toBe(1.0);
    });
  });

  describe("レベル差によるスコア減衰", () => {
    it("差1 → 0.7", () => {
      // JUNIOR(1)要求 vs 0件→ENTRY(0)推定 → diff=1
      expect(calculateExperienceMatch("JUNIOR", [])).toBe(0.7);
    });

    it("差2 → 0.4", () => {
      // MID(2)要求 vs 0件→ENTRY(0)推定 → diff=2
      expect(calculateExperienceMatch("MID", [])).toBe(0.4);
    });

    it("差3以上 → 0.2", () => {
      // LEAD(4)要求 vs 0件→ENTRY(0)推定 → diff=4
      expect(calculateExperienceMatch("LEAD", [])).toBe(0.2);
    });
  });

  describe("フラグメントタイプフィルタリング", () => {
    it("FACT, SKILL_USAGE, ACHIEVEMENTのみカウントされる", () => {
      const fragments = [
        { type: "FACT" },
        { type: "SKILL_USAGE" },
        { type: "ACHIEVEMENT" },
        { type: "VALUE" }, // カウントされない
        { type: "EMOTION" }, // カウントされない
        { type: "LEARNING" }, // カウントされない
      ];
      // 有効3件 → JUNIOR(1)推定
      expect(calculateExperienceMatch("JUNIOR", fragments)).toBe(1.0);
    });

    it("関連しないフラグメントのみの場合はENTRY扱い", () => {
      const fragments = [
        { type: "VALUE" },
        { type: "EMOTION" },
        { type: "LEARNING" },
      ];
      // 有効0件 → ENTRY(0)推定
      expect(calculateExperienceMatch("ENTRY", fragments)).toBe(1.0);
    });
  });

  describe("不明なレベル値", () => {
    it("未知の文字列はMID(2)相当にフォールバックする", () => {
      // 不明なレベル → levelMap[unknown] ?? 2 → MID
      // 0件→ENTRY(0)推定 vs MID(2) → diff=2 → 0.4
      expect(calculateExperienceMatch("UNKNOWN", [])).toBe(0.4);
    });
  });
});

// ── calculateJobMatchScore ──────────────────────────────────

describe("calculateJobMatchScore", () => {
  it("完全一致のスコアを計算する", () => {
    const result = calculateJobMatchScore(
      {
        skills: ["React", "TypeScript"],
        keywords: ["フロントエンド"],
        experienceLevel: "MID",
      },
      {
        skills: ["React", "TypeScript"],
        keywords: ["フロントエンド"],
        fragments: makeFragments(6),
      },
    );

    expect(result.skillScore).toBe(1.0);
    expect(result.keywordScore).toBe(1.0);
    expect(result.experienceScore).toBe(1.0);
    expect(result.totalScore).toBe(1.0);
  });

  it("デフォルト重みで加重平均を計算する（0.45/0.35/0.2）", () => {
    const result = calculateJobMatchScore(
      {
        skills: ["React", "Vue"], // 50%一致
        keywords: ["フロントエンド", "バックエンド"], // 50%一致
        experienceLevel: "MID",
      },
      {
        skills: ["React"],
        keywords: ["フロントエンド"],
        fragments: makeFragments(6), // MID → 完全一致
      },
    );

    expect(result.skillScore).toBe(0.5);
    expect(result.keywordScore).toBe(0.5);
    expect(result.experienceScore).toBe(1.0);
    // 0.5 * 0.45 + 0.5 * 0.35 + 1.0 * 0.2 = 0.225 + 0.175 + 0.2 = 0.6
    expect(result.totalScore).toBe(0.6);
  });

  it("カスタム重みを使用できる", () => {
    const result = calculateJobMatchScore(
      {
        skills: ["React"],
        keywords: [],
        experienceLevel: "ENTRY",
      },
      {
        skills: ["React"],
        keywords: [],
        fragments: [],
      },
      { skill: 1.0, keyword: 0, experience: 0 },
    );

    expect(result.totalScore).toBe(1.0);
  });

  it("スコアは小数点以下2桁に丸められる", () => {
    const result = calculateJobMatchScore(
      {
        skills: ["React", "Vue", "Angular"],
        keywords: [],
        experienceLevel: "ENTRY",
      },
      {
        skills: ["React"],
        keywords: [],
        fragments: [],
      },
    );

    // skillScore = 1/3 → 0.33
    expect(result.skillScore).toBe(0.33);
  });

  it("完全不一致の場合は低スコアを返す", () => {
    const result = calculateJobMatchScore(
      {
        skills: ["Python", "Go"],
        keywords: ["機械学習"],
        experienceLevel: "SENIOR",
      },
      {
        skills: ["React"],
        keywords: ["フロントエンド"],
        fragments: [],
      },
    );

    expect(result.skillScore).toBe(0);
    expect(result.keywordScore).toBe(0);
    // SENIOR(3) vs ENTRY(0) → diff=3 → 0.2
    expect(result.experienceScore).toBe(0.2);
    expect(result.totalScore).toBe(0.04); // 0 + 0 + 0.2*0.2
  });
});

// ── calculateWatchMatchScore ──────────────────────────────────

describe("calculateWatchMatchScore", () => {
  it("スキルのみの条件で計算する", () => {
    const score = calculateWatchMatchScore(
      { skills: ["React", "TypeScript"], keywords: [] },
      { skills: ["React", "TypeScript"], keywords: [] },
    );
    expect(score).toBe(1.0);
  });

  it("キーワードのみの条件で計算する", () => {
    const score = calculateWatchMatchScore(
      { skills: [], keywords: ["フロントエンド"] },
      { skills: [], keywords: ["フロントエンド"] },
    );
    expect(score).toBe(1.0);
  });

  it("スキル+キーワードを均等に重み付けする", () => {
    const score = calculateWatchMatchScore(
      {
        skills: ["React", "Vue"],
        keywords: ["フロントエンド", "バックエンド"],
      },
      { skills: ["React"], keywords: ["フロントエンド"] },
    );
    // skillScore=0.5, keywordScore=0.5
    // (0.5*0.5 + 0.5*0.5) / (0.5+0.5) = 0.5
    expect(score).toBe(0.5);
  });

  it("条件がない場合はデフォルトで0.5を返す", () => {
    const score = calculateWatchMatchScore(
      { skills: [], keywords: [] },
      { skills: ["React"], keywords: ["フロントエンド"] },
    );
    expect(score).toBe(0.5);
  });

  it("experienceLevelは無視される（ウォッチではスキルとキーワードのみ）", () => {
    const score = calculateWatchMatchScore(
      { skills: ["React"], keywords: [], experienceLevel: "SENIOR" },
      { skills: ["React"], keywords: [] },
    );
    expect(score).toBe(1.0);
  });
});

// ── extractSkillsAndKeywords ──────────────────────────────────

describe("extractSkillsAndKeywords", () => {
  it("フラグメントからスキルとキーワードを集約する", () => {
    const result = extractSkillsAndKeywords([
      { skills: ["React", "TypeScript"], keywords: ["フロントエンド"] },
      { skills: ["Node.js"], keywords: ["バックエンド", "API"] },
    ]);

    expect(result.skills).toEqual(
      expect.arrayContaining(["React", "TypeScript", "Node.js"]),
    );
    expect(result.skills).toHaveLength(3);
    expect(result.keywords).toEqual(
      expect.arrayContaining(["フロントエンド", "バックエンド", "API"]),
    );
    expect(result.keywords).toHaveLength(3);
  });

  it("重複するスキル・キーワードは除去される", () => {
    const result = extractSkillsAndKeywords([
      { skills: ["React", "TypeScript"], keywords: ["フロントエンド"] },
      { skills: ["React", "Node.js"], keywords: ["フロントエンド", "API"] },
    ]);

    expect(result.skills).toHaveLength(3); // React重複除去
    expect(result.keywords).toHaveLength(2); // フロントエンド重複除去
  });

  it("空のフラグメント配列では空のスキル・キーワードを返す", () => {
    const result = extractSkillsAndKeywords([]);
    expect(result.skills).toEqual([]);
    expect(result.keywords).toEqual([]);
  });

  it("スキル・キーワードが空のフラグメントを処理できる", () => {
    const result = extractSkillsAndKeywords([
      { skills: [], keywords: [] },
      { skills: ["React"], keywords: [] },
    ]);
    expect(result.skills).toEqual(["React"]);
    expect(result.keywords).toEqual([]);
  });
});

// ── テスト用ヘルパー ──────────────────────────────────

function makeFragments(count: number, type = "FACT"): { type: string }[] {
  return Array.from({ length: count }, () => ({ type }));
}
