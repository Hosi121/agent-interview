"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PointTransaction {
  id: string;
  type: string;
  action: string | null;
  amount: number;
  balance: number;
  description: string | null;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  GRANT: "付与",
  CONSUME: "消費",
  PURCHASE: "購入",
  EXPIRE: "期限切れ",
  REFUND: "返還",
};

const ACTION_LABELS: Record<string, string> = {
  CONVERSATION: "エージェント会話",
  CONTACT_DISCLOSURE: "連絡先開示",
  MESSAGE_SEND: "メッセージ送信",
};

export function PointHistory() {
  const [history, setHistory] = useState<PointTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const fetchHistory = useCallback(async (currentOffset: number) => {
    try {
      const response = await fetch(
        `/api/subscription/history?limit=${limit}&offset=${currentOffset}`,
      );
      if (response.ok) {
        const data = await response.json();
        if (currentOffset === 0) {
          setHistory(data.history);
        } else {
          setHistory((prev) => [...prev, ...data.history]);
        }
        setHasMore(data.history.length === limit);
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory(0);
  }, [fetchHistory]);

  const loadMore = () => {
    const newOffset = offset + limit;
    setOffset(newOffset);
    fetchHistory(newOffset);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">
            ポイント履歴がありません
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b">
        <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
          ポイント履歴
        </span>
      </div>
      <div>
        {history.map((transaction) => (
          <div
            key={transaction.id}
            className="flex items-center justify-between px-5 py-4 border-b hover:bg-secondary/30 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full",
                  transaction.amount > 0
                    ? "bg-green-100 text-green-600"
                    : "bg-red-100 text-red-600",
                )}
              >
                {transaction.amount > 0 ? (
                  <svg
                    className="size-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                ) : (
                  <svg
                    className="size-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 12H4"
                    />
                  </svg>
                )}
              </div>
              <div>
                <p className="font-medium text-sm">
                  {transaction.action
                    ? ACTION_LABELS[transaction.action] || transaction.action
                    : TYPE_LABELS[transaction.type] || transaction.type}
                </p>
                <p className="text-sm text-muted-foreground">
                  {transaction.description}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {new Date(transaction.createdAt).toLocaleString("ja-JP")}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p
                className={cn(
                  "font-semibold tabular-nums",
                  transaction.amount > 0 ? "text-green-600" : "text-red-600",
                )}
              >
                {transaction.amount > 0 ? "+" : ""}
                {transaction.amount} pt
              </p>
              <p className="text-sm text-muted-foreground tabular-nums">
                残高: {transaction.balance} pt
              </p>
            </div>
          </div>
        ))}
      </div>
      {hasMore && (
        <div className="px-5 py-4 text-center border-t">
          <Button variant="outline" onClick={loadMore}>
            さらに読み込む
          </Button>
        </div>
      )}
    </div>
  );
}
