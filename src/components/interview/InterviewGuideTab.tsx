"use client";

import { Button } from "@/components/ui/button";
import { MissingInfoAlert } from "./MissingInfoAlert";

interface InterviewGuide {
  questions: string[];
  missingInfo: string[];
  focusAreas?: string[];
}

interface InterviewGuideTabProps {
  selectedJobId: string;
  isGuideLoading: boolean;
  guide: InterviewGuide | null;
  followUps: string[];
  onInsertMessage: (message: string) => void;
}

export function InterviewGuideTab({
  selectedJobId,
  isGuideLoading,
  guide,
  followUps,
  onInsertMessage,
}: InterviewGuideTabProps) {
  if (!selectedJobId) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-muted-foreground text-pretty">
          求人を選択すると面接設計を表示します
        </p>
      </div>
    );
  }

  if (isGuideLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!guide) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-muted-foreground text-pretty">
          面接設計を取得できませんでした
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium text-balance">質問テンプレ</p>
        <div className="space-y-2">
          {guide.questions.map((question) => (
            <div key={question} className="rounded-md border border-muted p-2">
              <p className="text-sm text-pretty">{question}</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 h-8 text-xs px-3"
                onClick={() => onInsertMessage(question)}
              >
                入力に挿入
              </Button>
            </div>
          ))}
        </div>
      </div>

      {guide.missingInfo.length > 0 && (
        <MissingInfoAlert
          items={guide.missingInfo}
          onAskAbout={(item) =>
            onInsertMessage(`${item}について教えてください。`)
          }
        />
      )}

      {guide.focusAreas && guide.focusAreas.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-balance">重点観点</p>
          <ul className="space-y-1 text-sm text-muted-foreground text-pretty">
            {guide.focusAreas.map((item) => (
              <li key={item}>・{item}</li>
            ))}
          </ul>
        </div>
      )}

      {followUps.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-balance">
            直近回答の深掘り候補
          </p>
          <div className="space-y-2">
            {followUps.map((item) => (
              <Button
                key={item}
                size="sm"
                variant="secondary"
                className="w-full justify-start"
                onClick={() => onInsertMessage(item)}
              >
                {item}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
