"use client";

import { Button } from "@/components/ui/button";

interface MessageSnippet {
  messageId: string;
  snippet: string;
}

export interface EvidenceFragment {
  id: string;
  type: string;
  content: string;
  skills: string[];
  keywords: string[];
  count: number;
  messageSnippets?: MessageSnippet[];
}

interface EvidencePackProps {
  evidence: EvidenceFragment[];
  onScrollToMessage?: (messageId: string) => void;
}

export function EvidencePack({
  evidence,
  onScrollToMessage,
}: EvidencePackProps) {
  if (evidence.length === 0) {
    return null;
  }

  // Group by type
  const groupedByType = evidence.reduce(
    (acc, item) => {
      if (!acc[item.type]) {
        acc[item.type] = [];
      }
      acc[item.type].push(item);
      return acc;
    },
    {} as Record<string, EvidenceFragment[]>,
  );

  const typeLabels: Record<string, string> = {
    EXPERIENCE: "経験",
    SKILL: "スキル",
    EDUCATION: "学歴",
    PROJECT: "プロジェクト",
    PREFERENCE: "希望条件",
    OTHER: "その他",
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-balance tabular-nums">
        根拠パック（参照 {evidence.length}件）
      </p>
      <div className="space-y-3">
        {Object.entries(groupedByType).map(([type, items]) => (
          <div key={type} className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {typeLabels[type] || type}
            </p>
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-md border border-muted p-2 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium text-foreground bg-muted px-1.5 py-0.5 rounded-md tabular-nums">
                    参照 {item.count}回
                  </span>
                  {item.skills.length > 0 && (
                    <div className="flex gap-1 flex-wrap justify-end">
                      {item.skills.slice(0, 3).map((skill) => (
                        <span
                          key={skill}
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground text-pretty">
                  {item.content}
                </p>
                {item.messageSnippets && item.messageSnippets.length > 0 && (
                  <div className="pt-1 border-t border-muted mt-1.5">
                    <p className="text-xs text-muted-foreground mb-1">
                      参照箇所:
                    </p>
                    <div className="space-y-1">
                      {item.messageSnippets.slice(0, 2).map((ms, idx) => (
                        <div
                          key={`${ms.messageId}-${idx}`}
                          className="flex items-center gap-2"
                        >
                          <span className="text-xs text-muted-foreground truncate flex-1">
                            「{ms.snippet}」
                          </span>
                          {onScrollToMessage && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px]"
                              onClick={() => onScrollToMessage(ms.messageId)}
                            >
                              確認
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
