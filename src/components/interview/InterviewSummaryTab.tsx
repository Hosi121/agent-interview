"use client";

import { Button } from "@/components/ui/button";
import type { EvidenceFragment } from "./EvidencePack";
import { EvidencePack } from "./EvidencePack";

interface MessageSnippet {
  messageId: string;
  snippet: string;
}

interface SummaryEvidenceFragment extends EvidenceFragment {
  messageSnippets?: MessageSnippet[];
}

interface SummaryData {
  summary: string | null;
  messageCount: number;
  lastMessageAt: string | null;
  evidence?: SummaryEvidenceFragment[];
}

interface InterviewSummaryTabProps {
  summary: SummaryData | null;
  isSummaryLoading: boolean;
  messageCount: number;
  onRefresh: () => void;
  onScrollToMessage: (messageId: string) => void;
}

export function InterviewSummaryTab({
  summary,
  isSummaryLoading,
  messageCount,
  onRefresh,
  onScrollToMessage,
}: InterviewSummaryTabProps) {
  if (isSummaryLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (summary?.summary) {
    return (
      <div className="space-y-3">
        <div className="text-xs text-muted-foreground text-pretty tabular-nums">
          {summary.messageCount}件のメッセージを分析
        </div>
        <div className="prose prose-sm max-w-none">
          <div className="whitespace-pre-wrap text-sm text-pretty">
            {summary.summary}
          </div>
        </div>
        {summary.evidence && summary.evidence.length > 0 && (
          <EvidencePack
            evidence={summary.evidence}
            onScrollToMessage={onScrollToMessage}
          />
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs px-3 w-full"
          onClick={onRefresh}
        >
          要約を更新
        </Button>
      </div>
    );
  }

  return (
    <div className="text-center py-4 space-y-2">
      <p className="text-sm text-muted-foreground text-pretty">
        {messageCount === 0
          ? "会話を開始すると要約を生成できます"
          : "会話の要約を生成します"}
      </p>
      {messageCount > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs px-3"
          onClick={onRefresh}
        >
          要約を生成
        </Button>
      )}
    </div>
  );
}
