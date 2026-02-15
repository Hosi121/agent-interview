"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PlanChangeProps {
  currentPlan: string | null;
  onPlanChanged: () => void;
}

const PLANS = [
  {
    id: "LIGHT",
    name: "ライト",
    price: 29800,
    points: 100,
    pointPrice: 298,
    additionalPrice: 500,
    features: ["月100ポイント付与", "エージェント検索", "基本サポート"],
  },
  {
    id: "STANDARD",
    name: "スタンダード",
    price: 79800,
    points: 300,
    pointPrice: 266,
    additionalPrice: 400,
    features: [
      "月300ポイント付与",
      "エージェント検索",
      "優先サポート",
      "詳細分析レポート",
    ],
    recommended: true,
  },
  {
    id: "ENTERPRISE",
    name: "エンタープライズ",
    price: 198000,
    points: 1000,
    pointPrice: 198,
    additionalPrice: 300,
    features: [
      "月1000ポイント付与",
      "エージェント検索",
      "専任サポート",
      "詳細分析レポート",
      "API連携",
      "カスタム機能",
    ],
  },
];

export function PlanChange({ currentPlan, onPlanChanged }: PlanChangeProps) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isChanging, setIsChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChangePlan = async () => {
    if (!selectedPlan) return;

    setIsChanging(true);
    setError(null);

    try {
      const response = await fetch("/api/subscription/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType: selectedPlan }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "プラン変更に失敗しました");
      }

      onPlanChanged();
      setSelectedPlan(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const isSelected = selectedPlan === plan.id;

          return (
            <Card
              key={plan.id}
              className={cn(
                "relative cursor-pointer transition-all",
                isSelected && "ring-2 ring-primary",
                isCurrent && "border-primary",
                plan.recommended && "border-2 border-primary",
              )}
              onClick={() => !isCurrent && setSelectedPlan(plan.id)}
            >
              {plan.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-primary text-primary-foreground">
                    おすすめ
                  </span>
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 right-4">
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground">
                    現在のプラン
                  </span>
                </div>
              )}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>
                  <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                    ¥{plan.price.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground">/月</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">月間ポイント</span>
                    <span className="font-medium tabular-nums">
                      {plan.points} pt
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ポイント単価</span>
                    <span className="font-medium tabular-nums">
                      ¥{plan.pointPrice}/pt
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">追加購入単価</span>
                    <span className="font-medium tabular-nums">
                      ¥{plan.additionalPrice}/pt
                    </span>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <ul className="space-y-2">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-center gap-2 text-sm"
                      >
                        <svg
                          className="size-4 text-green-500 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {selectedPlan && selectedPlan !== currentPlan && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {PLANS.find((p) => p.id === selectedPlan)?.name}プランに変更
                </p>
                <p className="text-sm text-muted-foreground">
                  {currentPlan
                    ? "次回請求日から新しいプランが適用されます"
                    : "今すぐプランが有効になります"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedPlan(null)}
                  disabled={isChanging}
                >
                  キャンセル
                </Button>
                <Button onClick={handleChangePlan} disabled={isChanging}>
                  {isChanging
                    ? "処理中..."
                    : currentPlan
                      ? "プランを変更"
                      : "プランを選択"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
