import type { FragmentType } from "@prisma/client";
import type { ChatCoverageState, CoverageCategoryDetail } from "@/types";

interface CoverageRequirement {
  category: FragmentType;
  label: string;
  required: number;
  weight: number;
}

export const COVERAGE_REQUIREMENTS: CoverageRequirement[] = [
  { category: "ACHIEVEMENT", label: "成果・実績", required: 2, weight: 0.25 },
  { category: "CHALLENGE", label: "困難克服経験", required: 1, weight: 0.2 },
  { category: "SKILL_USAGE", label: "スキル使用例", required: 2, weight: 0.2 },
  { category: "LEARNING", label: "学び・気づき", required: 1, weight: 0.15 },
  { category: "FACT", label: "基本情報", required: 1, weight: 0.1 },
  { category: "VALUE", label: "価値観", required: 1, weight: 0.1 },
];

interface Fragment {
  type: FragmentType | string;
}

export function calculateCoverage(fragments: Fragment[]): ChatCoverageState {
  const categoryCounts = new Map<string, number>();

  for (const fragment of fragments) {
    const count = categoryCounts.get(fragment.type) || 0;
    categoryCounts.set(fragment.type, count + 1);
  }

  let totalWeight = 0;
  let achievedWeight = 0;

  const categories: CoverageCategoryDetail[] = COVERAGE_REQUIREMENTS.map(
    (req) => {
      const current = categoryCounts.get(req.category) || 0;
      const fulfilled = current >= req.required;
      const fulfillmentRatio = Math.min(current / req.required, 1);

      totalWeight += req.weight;
      achievedWeight += req.weight * fulfillmentRatio;

      return {
        category: req.category,
        label: req.label,
        current,
        required: req.required,
        fulfilled,
      };
    },
  );

  const percentage = Math.round((achievedWeight / totalWeight) * 100);

  return {
    percentage,
    isReadyToFinish: percentage >= 80,
    isComplete: percentage >= 100,
    categories,
  };
}
