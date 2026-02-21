"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { AgentBusinessCard } from "@/components/agent";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DashboardData {
  agent: {
    status: "PRIVATE" | "PUBLIC";
    systemPrompt: string;
  } | null;
  fragments: {
    id: string;
    skills: string[];
    keywords: string[];
  }[];
  coverage: {
    percentage: number;
    isReadyToFinish: boolean;
    isComplete: boolean;
    categories: {
      label: string;
      required: number;
      current: number;
      fulfilled: boolean;
    }[];
  } | null;
  settings: {
    name: string;
    avatarUrl: string | null;
    avatarPath: string | null;
  } | null;
  documents: {
    total: number;
    analyzed: number;
  };
  interests: {
    total: number;
    new: number;
  };
}

const initialData: DashboardData = {
  agent: null,
  fragments: [],
  coverage: null,
  settings: null,
  documents: { total: 0, analyzed: 0 },
  interests: { total: 0, new: 0 },
};

export default function ApplicantDashboard() {
  const { data: session } = useSession();
  const [data, setData] = useState<DashboardData>(initialData);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [agentRes, settingsRes, docsRes, inboxRes] = await Promise.all([
        fetch("/api/agents/me"),
        fetch("/api/applicant/settings"),
        fetch("/api/documents"),
        fetch("/api/applicant/inbox"),
      ]);

      const [agentData, settingsData, docsData, inboxData] = await Promise.all([
        agentRes.ok ? agentRes.json() : null,
        settingsRes.ok ? settingsRes.json() : null,
        docsRes.ok ? docsRes.json() : null,
        inboxRes.ok ? inboxRes.json() : null,
      ]);

      setData({
        agent: agentData?.agent ?? null,
        fragments: agentData?.fragments ?? [],
        coverage: agentData?.coverage ?? null,
        settings: settingsData?.settings ?? null,
        documents: {
          total: docsData?.documents?.length ?? 0,
          analyzed:
            docsData?.documents?.filter(
              (d: { analysisStatus: string }) =>
                d.analysisStatus === "COMPLETED",
            ).length ?? 0,
        },
        interests: {
          total: inboxData?.interests?.length ?? 0,
          new:
            inboxData?.interests?.filter(
              (i: { status: string }) => i.status === "EXPRESSED",
            ).length ?? 0,
        },
      });
    } catch {
      // silently fail — dashboard is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const allSkills = [...new Set(data.fragments.flatMap((f) => f.skills))];
  const userName = data.settings?.name ?? session?.user?.name ?? "";
  const avatarUrl = data.settings?.avatarUrl ?? null;
  const agentStatus = data.agent?.status as "PUBLIC" | "PRIVATE" | undefined;

  const steps = [
    {
      label: "AIと対話",
      desc: "経験やスキルをAIに伝えて、記憶のかけらを作成",
      href: "/my/chat",
      done: data.fragments.length > 0,
      stat:
        data.fragments.length > 0 ? `${data.fragments.length} かけら` : null,
      cta: "対話を始める",
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      ),
    },
    {
      label: "ドキュメント",
      desc: "履歴書やポートフォリオをアップロード",
      href: "/my/documents",
      done: data.documents.total > 0,
      stat:
        data.documents.total > 0 ? `${data.documents.total} ファイル` : null,
      cta: "アップロード",
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      ),
    },
    {
      label: "エージェント公開",
      desc: "採用担当者があなたのエージェントと対話できるようにする",
      href: "/my/agent",
      done: agentStatus === "PUBLIC",
      stat: agentStatus === "PUBLIC" ? "公開中" : null,
      cta: "公開する",
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      ),
    },
    {
      label: "受信箱を確認",
      desc: "企業からの興味表明やメッセージを確認",
      href: "/my/inbox",
      done: data.interests.total > 0,
      stat:
        data.interests.new > 0
          ? `${data.interests.new} 件の新着`
          : data.interests.total > 0
            ? `${data.interests.total} 件`
            : null,
      cta: "確認する",
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      ),
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 挨拶 */}
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          こんにちは、{userName}さん
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          あなたの名刺を完成させて、採用担当者との対話を始めましょう
        </p>
      </div>

      {/* 名刺 + セットアップ */}
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* 名刺 + 統計 */}
        <div className="p-5 rounded-xl border bg-card space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
              あなたの名刺
            </p>
            <Link href="/my/agent">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground h-6 px-2"
              >
                設定 →
              </Button>
            </Link>
          </div>
          <div className="flex justify-center">
            <AgentBusinessCard
              name={userName || "Your Name"}
              avatarUrl={avatarUrl}
              skills={allSkills}
              status={
                agentStatus === "PUBLIC" || agentStatus === "PRIVATE"
                  ? agentStatus
                  : undefined
              }
              fragmentCount={data.fragments.length}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded-lg bg-secondary/50">
              <p className="text-base font-bold tabular-nums text-foreground">
                {data.fragments.length}
              </p>
              <p className="text-[10px] text-muted-foreground">かけら</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-secondary/50">
              <p className="text-base font-bold tabular-nums text-foreground">
                {allSkills.length}
              </p>
              <p className="text-[10px] text-muted-foreground">スキル</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-secondary/50">
              <p className="text-base font-bold tabular-nums text-foreground">
                {data.documents.total}
              </p>
              <p className="text-[10px] text-muted-foreground">文書</p>
            </div>
          </div>
        </div>

        {/* セットアップ進捗 */}
        <div className="p-6 rounded-xl border bg-card space-y-5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold tracking-tight">
                セットアップ
              </p>
              <span className="text-sm font-bold tabular-nums text-foreground">
                {doneCount}
                <span className="text-muted-foreground font-medium">
                  /{steps.length}
                </span>
              </span>
            </div>
            <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${(doneCount / steps.length) * 100}%` }}
              />
            </div>
          </div>

          {/* チェックポイントタイムライン */}
          <div className="relative">
            {steps.map((step, index) => {
              const isLast = index === steps.length - 1;

              return (
                <div key={step.href} className="relative flex gap-4">
                  {/* 縦ライン + チェックポイント丸 */}
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "size-7 rounded-full flex items-center justify-center shrink-0 z-10",
                        step.done
                          ? "bg-primary/10"
                          : "border-2 border-border bg-card",
                      )}
                    >
                      {step.done ? (
                        <svg
                          className="size-3.5 text-primary"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="size-3.5 text-muted-foreground"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          {step.icon}
                        </svg>
                      )}
                    </div>
                    {!isLast && <div className="w-px flex-1 bg-border" />}
                  </div>

                  {/* コンテンツ */}
                  <div
                    className={cn("flex-1 min-w-0", isLast ? "pb-0" : "pb-5")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "text-sm font-medium",
                            step.done ? "text-foreground" : "text-foreground",
                          )}
                        >
                          {step.label}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {step.desc}
                        </p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {step.stat && (
                          <span className="text-xs font-medium text-primary tabular-nums">
                            {step.stat}
                          </span>
                        )}
                        <Link href={step.href}>
                          <Button
                            variant={step.done ? "outline" : "default"}
                            size="sm"
                            className="h-7 text-xs px-3"
                          >
                            {step.done ? step.label : step.cta}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
