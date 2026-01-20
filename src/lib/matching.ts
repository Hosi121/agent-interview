import type { ExperienceLevel } from "@prisma/client";

/**
 * スキルマッチング計算（部分一致を考慮）
 * @returns 0-1のスコア
 */
export function calculateSkillMatch(
  requiredSkills: string[],
  candidateSkills: string[],
): number {
  if (requiredSkills.length === 0) return 1.0;
  if (candidateSkills.length === 0) return 0;

  const requiredSet = new Set(requiredSkills.map((s) => s.toLowerCase()));
  const candidateSet = new Set(candidateSkills.map((s) => s.toLowerCase()));

  let matchCount = 0;
  for (const skill of requiredSet) {
    for (const cSkill of candidateSet) {
      if (cSkill.includes(skill) || skill.includes(cSkill)) {
        matchCount++;
        break;
      }
    }
  }

  return matchCount / requiredSet.size;
}

/**
 * キーワードマッチング計算（部分一致を考慮）
 * @returns 0-1のスコア
 */
export function calculateKeywordMatch(
  requiredKeywords: string[],
  candidateKeywords: string[],
): number {
  if (requiredKeywords.length === 0) return 1.0;
  if (candidateKeywords.length === 0) return 0;

  const requiredSet = new Set(requiredKeywords.map((k) => k.toLowerCase()));
  const candidateSet = new Set(candidateKeywords.map((k) => k.toLowerCase()));

  let matchCount = 0;
  for (const keyword of requiredSet) {
    for (const cKeyword of candidateSet) {
      if (cKeyword.includes(keyword) || keyword.includes(cKeyword)) {
        matchCount++;
        break;
      }
    }
  }

  return matchCount / requiredSet.size;
}

/**
 * 経験レベルマッチング
 * フラグメント数から推定された経験レベルと要求レベルを比較
 * @returns 0-1のスコア
 */
export function calculateExperienceMatch(
  requiredLevel: ExperienceLevel | string,
  fragments: { type: string }[],
): number {
  const workFragments = fragments.filter(
    (f) =>
      f.type === "FACT" || f.type === "SKILL_USAGE" || f.type === "ACHIEVEMENT",
  );

  const experienceIndicators = workFragments.length;

  const levelMap: Record<string, number> = {
    ENTRY: 0,
    JUNIOR: 1,
    MID: 2,
    SENIOR: 3,
    LEAD: 4,
  };

  // フラグメント数から経験レベルを推定
  let estimatedLevel = 0;
  if (experienceIndicators >= 15) estimatedLevel = 4;
  else if (experienceIndicators >= 10) estimatedLevel = 3;
  else if (experienceIndicators >= 6) estimatedLevel = 2;
  else if (experienceIndicators >= 3) estimatedLevel = 1;

  const requiredLevelNum = levelMap[requiredLevel] ?? 2;

  const diff = Math.abs(estimatedLevel - requiredLevelNum);
  if (diff === 0) return 1.0;
  if (diff === 1) return 0.7;
  if (diff === 2) return 0.4;
  return 0.2;
}

/**
 * 求人とエージェントの総合マッチスコアを計算
 */
export function calculateJobMatchScore(
  job: {
    skills: string[];
    keywords: string[];
    experienceLevel: ExperienceLevel | string;
  },
  candidate: {
    skills: string[];
    keywords: string[];
    fragments: { type: string }[];
  },
  weights = { skill: 0.45, keyword: 0.35, experience: 0.2 },
): {
  totalScore: number;
  skillScore: number;
  keywordScore: number;
  experienceScore: number;
} {
  const skillScore = calculateSkillMatch(job.skills, candidate.skills);
  const keywordScore = calculateKeywordMatch(job.keywords, candidate.keywords);
  const experienceScore = calculateExperienceMatch(
    job.experienceLevel,
    candidate.fragments,
  );

  const totalScore =
    skillScore * weights.skill +
    keywordScore * weights.keyword +
    experienceScore * weights.experience;

  return {
    totalScore: Math.round(totalScore * 100) / 100,
    skillScore: Math.round(skillScore * 100) / 100,
    keywordScore: Math.round(keywordScore * 100) / 100,
    experienceScore: Math.round(experienceScore * 100) / 100,
  };
}

/**
 * ウォッチ条件とエージェントのマッチスコアを計算
 * スキルとキーワードのみで計算（経験レベルは任意）
 */
export function calculateWatchMatchScore(
  watch: {
    skills: string[];
    keywords: string[];
    experienceLevel?: ExperienceLevel | null;
  },
  candidate: {
    skills: string[];
    keywords: string[];
    fragments?: { type: string }[];
  },
): number {
  let score = 0;
  let weight = 0;

  if (watch.skills.length > 0) {
    const skillScore = calculateSkillMatch(watch.skills, candidate.skills);
    score += skillScore * 0.5;
    weight += 0.5;
  }

  if (watch.keywords.length > 0) {
    const keywordScore = calculateKeywordMatch(
      watch.keywords,
      candidate.keywords,
    );
    score += keywordScore * 0.5;
    weight += 0.5;
  }

  // 条件がない場合はデフォルトで0.5を返す
  if (weight === 0) return 0.5;

  return score / weight;
}

/**
 * フラグメントからスキルとキーワードを抽出
 */
export function extractSkillsAndKeywords(
  fragments: { skills: string[]; keywords: string[] }[],
): { skills: string[]; keywords: string[] } {
  const skills = [...new Set(fragments.flatMap((f) => f.skills))];
  const keywords = [...new Set(fragments.flatMap((f) => f.keywords))];
  return { skills, keywords };
}
