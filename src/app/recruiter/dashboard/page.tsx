"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { MembersResponse } from "@/lib/types/recruiter";
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

export default function RecruiterDashboard() {
  const { data: session } = useSession();
  const [recentSessions, setRecentSessions] = useState<InterviewSession[]>([]);
  const [totalSessionCount, setTotalSessionCount] = useState(0);
  const [agentCount, setAgentCount] = useState(0);
  const [membersData, setMembersData] = useState<MembersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [sessionsRes, agentsRes, membersRes] = await Promise.all([
        fetch("/api/recruiter/sessions?scope=company"),
        fetch("/api/agents/public"),
        fetch("/api/recruiter/members"),
      ]);

      if (sessionsRes.ok) {
        const data = await sessionsRes.json();
        setTotalSessionCount(data.sessions.length);
        setRecentSessions(data.sessions.slice(0, 5));
      }

      if (agentsRes.ok) {
        const data = await agentsRes.json();
        setAgentCount(data.agents.length);
      }

      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembersData(data);
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

  const inviteCount = useMemo(
    () => membersData?.invites?.length ?? 0,
    [membersData?.invites?.length],
  );

  const activeMemberCount = useMemo(
    () =>
      membersData?.members?.filter((m) => m.status === "ACTIVE").length ?? 0,
    [membersData?.members],
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ダッシュボード</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {session?.user?.companyName}様、ようこそ
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              公開エージェント
            </CardTitle>
            <CardDescription>面接可能なエージェントの数</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-primary">{agentCount}</p>
            <Link href="/recruiter/agents">
              <Button variant="outline" className="mt-4">
                一覧を見る
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-primary"
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
              面接セッション
            </CardTitle>
            <CardDescription>実施した面接の数</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-primary">
              {totalSessionCount}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              メンバー / 招待
            </CardTitle>
            <CardDescription>会社アカウントの管理</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-sm text-muted-foreground">メンバー</p>
                <p className="text-3xl font-bold">{activeMemberCount}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">招待中</p>
                <p className="text-3xl font-bold">{inviteCount}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Link href="/recruiter/members">
                <Button size="sm">メンバーを管理</Button>
              </Link>
              <Link href="/recruiter/members">
                <Button size="sm" variant="outline">
                  招待リンクを作成
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-primary"
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
              会社の状態
            </CardTitle>
            <CardDescription>
              {membersData?.company?.name ?? "会社情報を取得中"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md border">
                あなたの権限
              </span>
              <span className="font-medium">{membersData?.myRole ?? "-"}</span>
            </div>
            <p className="text-sm text-muted-foreground text-pretty">
              招待制で2人目以降の採用担当者を追加できます。
              「招待リンクを作成」からメールアドレスを入力し、リンクを共有してください。
            </p>
          </CardContent>
        </Card>
      </div>

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
                className="w-5 h-5 text-muted-foreground"
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
          </div>
        )}
      </div>
    </div>
  );
}
