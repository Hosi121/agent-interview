"use client";

import { CheckCircle, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatCoverageState } from "@/types";

interface FinishSuggestionProps {
  coverage: ChatCoverageState;
  onContinue?: () => void;
}

export function FinishSuggestion({
  coverage,
  onContinue,
}: FinishSuggestionProps) {
  const router = useRouter();

  if (!coverage.isReadyToFinish) {
    return null;
  }

  const handleFinish = () => {
    router.push("/my/agent");
  };

  const isComplete = coverage.isComplete;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-lg p-4",
        isComplete
          ? "bg-green-50 border border-green-200 dark:bg-green-950/20 dark:border-green-800"
          : "bg-blue-50 border border-blue-200 dark:bg-blue-950/20 dark:border-blue-800",
      )}
    >
      <div className="flex items-center gap-3">
        {isComplete ? (
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
        ) : (
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        )}
        <div>
          <p
            className={cn(
              "font-medium",
              isComplete
                ? "text-green-800 dark:text-green-200"
                : "text-blue-800 dark:text-blue-200",
            )}
          >
            {isComplete ? "情報収集が完了しました" : "そろそろ終わりにできます"}
          </p>
          <p
            className={cn(
              "text-sm",
              isComplete
                ? "text-green-600 dark:text-green-400"
                : "text-blue-600 dark:text-blue-400",
            )}
          >
            {isComplete
              ? "十分な情報が集まりました。エージェントを作成できます。"
              : `進捗${coverage.percentage}% - もう少し話すとより良いエージェントになります。`}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        {!isComplete && onContinue && (
          <Button variant="ghost" size="sm" onClick={onContinue}>
            もう少し話す
          </Button>
        )}
        <Button
          size="sm"
          onClick={handleFinish}
          className={cn(
            isComplete
              ? "bg-green-600 hover:bg-green-700"
              : "bg-blue-600 hover:bg-blue-700",
          )}
        >
          終了してエージェントを作成
        </Button>
      </div>
    </div>
  );
}
