"use client";

import { Check } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ChatCoverageState } from "@/types";

interface CoverageIndicatorProps {
  coverage: ChatCoverageState;
}

export function CoverageIndicator({ coverage }: CoverageIndicatorProps) {
  const getProgressColor = () => {
    if (coverage.isComplete) return "bg-green-500";
    if (coverage.isReadyToFinish) return "bg-blue-500";
    return "bg-primary";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">情報収集の進捗</CardTitle>
        <CardDescription>カテゴリ別の収集状況</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>全体の進捗</span>
            <span className="font-medium">{coverage.percentage}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                getProgressColor(),
              )}
              style={{ width: `${coverage.percentage}%` }}
            />
          </div>
        </div>

        <div className="space-y-2">
          {coverage.categories.map((cat) => (
            <div
              key={cat.category}
              className="flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full",
                    cat.fulfilled
                      ? "bg-green-500 text-white"
                      : "border border-muted-foreground",
                  )}
                >
                  {cat.fulfilled && <Check className="h-3 w-3" />}
                </div>
                <span
                  className={
                    cat.fulfilled ? "text-foreground" : "text-muted-foreground"
                  }
                >
                  {cat.label}
                </span>
              </div>
              <span className="text-muted-foreground">
                {cat.current}/{cat.required}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
