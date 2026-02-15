"use client";

import type { SubscriptionData } from "@/app/recruiter/billing/page";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface BillingOverviewProps {
  subscription: SubscriptionData;
}

export function BillingOverview({ subscription }: BillingOverviewProps) {
  const nextBillingDate = new Date(subscription.billingCycleStart);
  nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

  const usagePercent = Math.round(
    ((subscription.pointsIncluded - subscription.pointBalance) /
      subscription.pointsIncluded) *
      100,
  );

  return (
    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardDescription>現在のプラン</CardDescription>
          <CardTitle className="flex items-center gap-2">
            {subscription.planName}
            <span
              className={cn(
                "text-[10px] font-medium px-2 py-0.5 rounded-md",
                subscription.status === "ACTIVE"
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-secondary text-secondary-foreground",
              )}
            >
              {subscription.status === "ACTIVE" ? "有効" : subscription.status}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold tabular-nums">
            ¥{subscription.priceMonthly.toLocaleString()}
            <span className="text-sm font-normal text-muted-foreground">
              /月
            </span>
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            次回請求日:{" "}
            <span className="tabular-nums">
              {nextBillingDate.toLocaleDateString("ja-JP")}
            </span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>ポイント残高</CardDescription>
          <CardTitle className="tabular-nums">
            {subscription.pointBalance.toLocaleString()} pt
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>今月の使用量</span>
              <span className="tabular-nums">{usagePercent}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              月間付与: {subscription.pointsIncluded.toLocaleString()} pt
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>追加ポイント単価</CardDescription>
          <CardTitle className="tabular-nums">
            ¥{subscription.additionalPointPrice.toLocaleString()}
            <span className="text-sm font-normal text-muted-foreground">
              /pt
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            ポイントが不足した場合、追加購入できます
          </p>
        </CardContent>
      </Card>

      <Card className="md:col-span-2 lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-base">ポイント消費ガイド</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
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
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium">エージェント会話</p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  1 pt / 回
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
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
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium">興味表明</p>
                <p className="text-sm text-muted-foreground">無料</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
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
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium">メッセージ送信</p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  3 pt / 通
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
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
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium">連絡先開示</p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  10 pt / 件
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
