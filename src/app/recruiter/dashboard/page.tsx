"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface InterviewSession {
  id: string;
  agent: {
    id: string;
    user: {
      name: string;
    };
  };
  createdAt: string;
  messages: { id: string }[];
}

interface Job {
  id: string;
  title: string;
  status: string;
  _count: {
    matches: number;
    pipelines: number;
  };
}

interface SubscriptionData {
  pointBalance: number;
  planName: string;
}

type PipelineStage =
  | "INTERESTED"
  | "CONTACTED"
  | "SCREENING"
  | "INTERVIEWING"
  | "OFFER"
  | "HIRED"
  | "REJECTED"
  | "WITHDRAWN";

const DISPLAY_STAGES: { key: PipelineStage; label: string }[] = [
  { key: "INTERESTED", label: "興味あり" },
  { key: "CONTACTED", label: "連絡済み" },
  { key: "INTERVIEWING", label: "面談中" },
  { key: "OFFER", label: "オファー" },
  { key: "HIRED", label: "採用" },
  { key: "REJECTED", label: "不採用" },
];

export default function RecruiterDashboard() {
  const { data: session } = useSession();
  const [recentSessions, setRecentSessions] = useState<InterviewSession[]>([]);
  const [pipelineCounts, setPipelineCounts] = useState<Record<string, number>>(
    {},
  );
  const [jobs, setJobs] = useState<Job[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(
    null,
  );
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [sessionsRes, pipelineRes, jobsRes, subRes, notifRes] =
        await Promise.all([
          fetch("/api/recruiter/sessions?scope=company"),
          fetch("/api/recruiter/pipeline"),
          fetch("/api/recruiter/jobs?status=ACTIVE"),
          fetch("/api/subscription"),
          fetch("/api/recruiter/notifications?unreadOnly=true"),
        ]);

      if (sessionsRes.ok) {
        const data = await sessionsRes.json();
        setRecentSessions(data.sessions.slice(0, 5));
      }

      if (pipelineRes.ok) {
        const data = await pipelineRes.json();
        setPipelineCounts(data.counts);
      }

      if (jobsRes.ok) {
        const data = await jobsRes.json();
        setJobs(data.jobs);
      }

      if (subRes.ok) {
        const data = await subRes.json();
        if (data.subscription) {
          setSubscription(data.subscription);
        }
      }

      if (notifRes.ok) {
        const data = await notifRes.json();
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPipelineCandidates = DISPLAY_STAGES.reduce(
    (sum, s) => sum + (pipelineCounts[s.key] ?? 0),
    0,
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ダッシュボード</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {session?.user?.companyName}様、ようこそ
          </p>
        </div>
        {unreadCount > 0 && (
          <Link
            href="/recruiter/notifications"
            className="relative inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-secondary/30 transition-colors"
          >
            <svg
              className="size-4 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {unreadCount}
            </span>
          </Link>
        )}
      </div>

      {/* Summary Stats */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="grid grid-cols-3 divide-x">
          <div className="px-5 py-4">
            <p className="text-2xl font-bold tabular-nums">
              {totalPipelineCandidates}
            </p>
            <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
              パイプライン候補者
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="text-2xl font-bold tabular-nums">{jobs.length}</p>
            <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
              アクティブ求人
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="text-2xl font-bold tabular-nums">
              {subscription?.pointBalance ?? 0}
            </p>
            <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
              {subscription?.planName ?? "未登録"}
            </p>
          </div>
        </div>
      </div>

      {/* Pipeline Flow */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b">
          <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
            採用パイプライン
          </span>
        </div>
        <div className="flex items-center divide-x">
          {DISPLAY_STAGES.map((stage) => {
            const count = pipelineCounts[stage.key] ?? 0;
            return (
              <Link
                key={stage.key}
                href={`/recruiter/pipeline?stage=${stage.key}`}
                className="flex-1 text-center py-4 px-2 hover:bg-secondary/30 transition-colors"
              >
                <p
                  className={cn(
                    "text-lg font-bold tabular-nums",
                    stage.key === "HIRED" && "text-emerald-600",
                    stage.key === "REJECTED" && "text-muted-foreground",
                  )}
                >
                  {count}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {stage.label}
                </p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Bottom 2-column */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Interviews */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b">
            <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
              最近の面接
            </span>
          </div>
          {recentSessions.length === 0 ? (
            <div className="py-16 space-y-3 text-center">
              <div className="mx-auto h-[2px] w-12 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />
              <div className="mx-auto size-10 rounded-lg bg-secondary flex items-center justify-center">
                <svg
                  className="size-5 text-muted-foreground"
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
              <p className="text-sm text-muted-foreground">
                まだ面接を実施していません
              </p>
              <Link href="/recruiter/agents">
                <Button className="mt-2">エージェント一覧を見る</Button>
              </Link>
            </div>
          ) : (
            <div>
              {recentSessions.map((s, i) => (
                <Link
                  key={s.id}
                  href={`/recruiter/interview/${s.agent.id}`}
                  className={cn(
                    "flex items-center justify-between px-5 py-4 hover:bg-secondary/30 transition-colors",
                    i < recentSessions.length - 1 && "border-b",
                  )}
                >
                  <div>
                    <p className="font-medium text-sm">{s.agent.user.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(s.createdAt).toLocaleDateString("ja-JP")}
                      <span className="mx-1.5 text-border">|</span>
                      {s.messages.length}メッセージ
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    続ける
                  </Button>
                </Link>
              ))}
              {recentSessions.length >= 5 && (
                <div className="px-5 py-3 border-t">
                  <Link
                    href="/recruiter/interviews"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    すべての面接を見る →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Active Jobs */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b">
            <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
              アクティブ求人
            </span>
          </div>
          {jobs.length === 0 ? (
            <div className="py-16 space-y-3 text-center">
              <div className="mx-auto h-[2px] w-12 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />
              <div className="mx-auto size-10 rounded-lg bg-secondary flex items-center justify-center">
                <svg
                  className="size-5 text-muted-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground">
                求人を作成しましょう
              </p>
              <Link href="/recruiter/jobs">
                <Button className="mt-2">求人を管理</Button>
              </Link>
            </div>
          ) : (
            <div>
              {jobs.map((job, i) => (
                <Link
                  key={job.id}
                  href={`/recruiter/jobs/${job.id}`}
                  className={cn(
                    "block px-5 py-4 hover:bg-secondary/30 transition-colors",
                    i < jobs.length - 1 && "border-b",
                  )}
                >
                  <p className="text-sm font-semibold">{job.title}</p>
                  <p className="text-[10px] text-muted-foreground tabular-nums mt-1">
                    マッチ {job._count.matches}件 ・ パイプライン{" "}
                    {job._count.pipelines}件
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
