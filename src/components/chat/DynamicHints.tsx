import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChatCoverageState } from "@/types";

const HINT_POOL: Record<string, string[]> = {
  ACHIEVEMENT: [
    "成果を話す際は、数字（売上○%向上、○人のチームなど）を入れると説得力が増します",
  ],
  CHALLENGE: [
    "困難な状況でどう判断し行動したかを具体的に話すと、問題解決力が伝わります",
  ],
  SKILL_USAGE: [
    "スキルは「使っている」だけでなく「どの場面でどう使ったか」を話すと具体性が増します",
  ],
  LEARNING: [
    "業務を通じて学んだことや、考え方が変わった経験を話してみましょう",
  ],
  FACT: ["職歴の概要（会社名、期間、役職）を伝えると基本情報が充実します"],
  VALUE: ["仕事で大切にしていることや、キャリアの判断基準を話してみましょう"],
};

const GENERIC_HINTS = [
  "具体的なエピソードを交えて話すと、より良いエージェントが作成できます",
  "数字や実績を含めると、説得力が増します",
  "困難を乗り越えた経験も重要な情報です",
];

interface DynamicHintsProps {
  coverage: ChatCoverageState;
}

export function DynamicHints({ coverage }: DynamicHintsProps) {
  const hints: string[] = [];

  const missingCategories = coverage.categories
    .filter((c) => !c.fulfilled)
    .slice(0, 2);

  for (const cat of missingCategories) {
    const pool = HINT_POOL[cat.category];
    if (pool && pool.length > 0) {
      hints.push(pool[0]);
    }
  }

  // 残り枠を汎用ヒントで埋める
  let genericIndex = 0;
  while (hints.length < 3 && genericIndex < GENERIC_HINTS.length) {
    const hint = GENERIC_HINTS[genericIndex];
    if (!hints.includes(hint)) {
      hints.push(hint);
    }
    genericIndex++;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">ヒント</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {hints.map((hint, i) => (
          <div key={hint} className="flex items-start gap-2">
            <Badge variant="outline" className="mt-0.5">
              {i + 1}
            </Badge>
            <p className="text-sm text-muted-foreground">{hint}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
