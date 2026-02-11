"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { AgentBusinessCard } from "@/components/agent";
import { Button } from "@/components/ui/button";

interface DashboardData {
  agent: {
    status: "PRIVATE" | "PUBLIC" | "DRAFT";
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

  const allSkills = [
    ...new Set(data.fragments.flatMap((f) => f.skills)),
  ];
  const coveragePercent = data.coverage?.percentage ?? 0;
  const userName = data.settings?.name ?? session?.user?.name ?? "";
  const avatarUrl = data.settings?.avatarUrl ?? null;
  const agentStatus = data.agent?.status as "PUBLIC" | "PRIVATE" | undefined;

  // ステップの状態を計算
  const steps = [
    {
      label: "AIと対話",
      desc: "経験やスキルを伝える",
      href: "/chat",
      done: data.fragments.length > 0,
      count: data.fragments.length,
      unit: "記憶のかけら",
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
      desc: "履歴書やポートフォリオ",
      href: "/documents",
      done: data.documents.total > 0,
      count: data.documents.total,
      unit: "files",
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
      desc: "採用担当者に公開する",
      href: "/agent",
      done: agentStatus === "PUBLIC",
      count: null,
      unit: null,
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
      label: "受信箱",
      desc: "企業からの関心",
      href: "/inbox",
      done: data.interests.total > 0,
      count: data.interests.total,
      unit: "件",
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          こんにちは、{userName}さん
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          あなたの名刺を完成させて、採用担当者との対話を始めましょう
        </p>
      </div>

      {/* ヒーロー: 名刺 + 統計 */}
      <div className="grid lg:grid-cols-[1fr_1fr] gap-6 items-start">
        {/* 名刺 + 統計 */}
        <div className="p-6 rounded-xl border bg-card space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
              あなたの名刺
            </p>
            <Link href="/agent">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                エージェント設定 →
              </Button>
            </Link>
          </div>
          <div className="flex justify-center">
            <AgentBusinessCard
              name={userName || "Your Name"}
              avatarUrl={avatarUrl}
              skills={allSkills}
              status={agentStatus === "PUBLIC" || agentStatus === "PRIVATE" ? agentStatus : undefined}
              fragmentCount={data.fragments.length}
              className="max-w-[340px]"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2.5 rounded-lg bg-secondary/50">
              <p className="text-lg font-bold tabular-nums text-foreground">
                {data.fragments.length}
              </p>
              <p className="text-[10px] text-muted-foreground">記憶のかけら</p>
            </div>
            <div className="text-center p-2.5 rounded-lg bg-secondary/50">
              <p className="text-lg font-bold tabular-nums text-foreground">
                {allSkills.length}
              </p>
              <p className="text-[10px] text-muted-foreground">スキル</p>
            </div>
            <div className="text-center p-2.5 rounded-lg bg-secondary/50">
              <p className="text-lg font-bold tabular-nums text-foreground">
                {data.documents.total}
              </p>
              <p className="text-[10px] text-muted-foreground">ドキュメント</p>
            </div>
          </div>
        </div>

        {/* プロフィール完成度 */}
        <div className="p-6 rounded-xl border bg-card space-y-5">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold tracking-tight">
                プロフィール完成度
              </p>
              <span className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
                {coveragePercent}
                <span className="text-sm font-medium text-muted-foreground">
                  %
                </span>
              </span>
            </div>
            {/* プログレスバー */}
            <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${coveragePercent}%` }}
              />
            </div>
          </div>

          {/* カテゴリ別進捗 */}
          {data.coverage?.categories && data.coverage.categories.length > 0 && (
            <div className="space-y-2">
              {data.coverage.categories.map((cat) => (
                <div key={cat.label} className="flex items-center gap-3">
                  <div className="size-5 rounded-full flex items-center justify-center shrink-0">
                    {cat.fulfilled ? (
                      <svg
                        className="size-4 text-primary"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <div className="size-3 rounded-full border-2 border-border" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{cat.label}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                    {cat.current}/{cat.required}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 完成度がない場合のフォールバック */}
          {(!data.coverage?.categories || data.coverage.categories.length === 0) && (
            <Link href="/chat">
              <Button className="w-full" size="sm">
                AIと対話してプロフィールを作る
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* ステップカード */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {steps.map((step) => (
          <Link
            key={step.href}
            href={step.href}
            className="group p-4 rounded-xl border bg-card hover:border-primary/30 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="size-8 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <svg
                  className="size-4 text-muted-foreground group-hover:text-primary transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {step.icon}
                </svg>
              </span>
              {step.done ? (
                <span className="size-5 rounded-full bg-primary/10 flex items-center justify-center">
                  <svg
                    className="size-3 text-primary"
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
                </span>
              ) : (
                <span className="size-5 rounded-full border-2 border-border" />
              )}
            </div>
            <p className="text-sm font-semibold tracking-tight">{step.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
            {step.count !== null && step.count > 0 && (
              <p className="text-xs text-primary font-medium mt-2 tabular-nums">
                {step.count} {step.unit}
              </p>
            )}
            {step.href === "/inbox" && data.interests.new > 0 && (
              <p className="text-xs text-primary font-medium mt-2 tabular-nums">
                {data.interests.new} 件の新着
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
