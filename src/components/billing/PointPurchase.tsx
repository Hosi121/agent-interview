"use client";

import { useState } from "react";
import type { SubscriptionData } from "@/app/recruiter/billing/page";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PointPurchaseProps {
  subscription: SubscriptionData;
  onPurchased: () => void;
}

const PRESET_AMOUNTS = [50, 100, 200, 500];

export function PointPurchase({
  subscription,
  onPurchased,
}: PointPurchaseProps) {
  const [amount, setAmount] = useState<number>(100);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const totalPrice = amount * subscription.additionalPointPrice;

  const handlePurchase = async () => {
    if (amount < 10) {
      setError("最低10ポイントから購入できます");
      return;
    }

    setIsPurchasing(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/subscription/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "ポイント購入に失敗しました");
      }

      const data = await response.json();
      setSuccess(
        `${amount}ポイントを購入しました。新しい残高: ${data.newBalance}pt`,
      );
      onPurchased();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>ポイント追加購入</CardTitle>
          <CardDescription>
            追加ポイントを購入して、より多くの候補者にアプローチできます
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>購入ポイント数</Label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_AMOUNTS.map((preset) => (
                <Button
                  key={preset}
                  variant={amount === preset ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAmount(preset)}
                >
                  {preset} pt
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-amount">カスタム数量</Label>
            <Input
              id="custom-amount"
              type="number"
              min={10}
              step={10}
              value={amount}
              onChange={(e) =>
                setAmount(Math.max(10, parseInt(e.target.value, 10) || 0))
              }
              className="tabular-nums"
            />
            <p className="text-xs text-muted-foreground">最低10ポイントから</p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 rounded-lg bg-green-100 text-green-700 text-sm">
              {success}
            </div>
          )}

          <Button
            className="w-full"
            onClick={handlePurchase}
            disabled={isPurchasing || amount < 10}
          >
            {isPurchasing ? "処理中..." : "購入する"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>購入内容の確認</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">購入ポイント</span>
              <span className="font-medium tabular-nums">{amount} pt</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">単価</span>
              <span className="font-medium tabular-nums">
                ¥{subscription.additionalPointPrice.toLocaleString()}/pt
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="font-medium">合計金額</span>
              <span className="text-xl font-bold tabular-nums">
                ¥{totalPrice.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted/50 space-y-2">
            <p className="font-medium">購入後の残高</p>
            <p className="text-2xl font-bold tabular-nums">
              {(subscription.pointBalance + amount).toLocaleString()} pt
            </p>
            <p className="text-xs text-muted-foreground">
              現在の残高: {subscription.pointBalance.toLocaleString()} pt +
              購入分: {amount} pt
            </p>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>※ 購入したポイントは即時反映されます</p>
            <p>※ ポイントの有効期限は購入日から1年間です</p>
            <p>※ 購入後の返金はできません</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
