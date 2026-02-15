"use client";

import { useCallback, useEffect, useState } from "react";
import { BillingOverview } from "@/components/billing/BillingOverview";
import { PlanChange } from "@/components/billing/PlanChange";
import { PointHistory } from "@/components/billing/PointHistory";
import { PointPurchase } from "@/components/billing/PointPurchase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface SubscriptionData {
  id: string;
  planType: string;
  planName: string;
  pointBalance: number;
  pointsIncluded: number;
  priceMonthly: number;
  additionalPointPrice: number;
  status: string;
  billingCycleStart: string;
}

export default function BillingPage() {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    try {
      const response = await fetch("/api/subscription");
      if (response.ok) {
        const data = await response.json();
        setSubscription(data.subscription);
      }
    } catch (error) {
      console.error("Failed to fetch subscription:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            プラン・ポイント管理
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            サブスクリプションがありません。プランを選択してください。
          </p>
        </div>
        <PlanChange currentPlan={null} onPlanChanged={fetchSubscription} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          プラン・ポイント管理
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          プランの確認・変更、ポイントの購入・履歴確認ができます
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-8">
        <TabsList>
          <TabsTrigger value="overview">概要</TabsTrigger>
          <TabsTrigger value="history">ポイント履歴</TabsTrigger>
          <TabsTrigger value="plan">プラン変更</TabsTrigger>
          <TabsTrigger value="purchase">ポイント購入</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <BillingOverview subscription={subscription} />
        </TabsContent>

        <TabsContent value="history">
          <PointHistory />
        </TabsContent>

        <TabsContent value="plan">
          <PlanChange
            currentPlan={subscription.planType}
            onPlanChanged={fetchSubscription}
          />
        </TabsContent>

        <TabsContent value="purchase">
          <PointPurchase
            subscription={subscription}
            onPurchased={fetchSubscription}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
