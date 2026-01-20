"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [sessionsRes, agentsRes] = await Promise.all([
        fetch("/api/recruiter/sessions"),
        fetch("/api/agents/public"),
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
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">ダッシュボード</h1>
        <p className="text-muted-foreground mt-2">
          {session?.user?.companyName}様、ようこそ
        </p>
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
            <p className="text-4xl font-bold text-primary">
              {isLoading ? "-" : agentCount}
            </p>
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
              {isLoading ? "-" : totalSessionCount}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>最近の面接</CardTitle>
          <CardDescription>最近実施した面接セッション</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">読み込み中...</p>
          ) : recentSessions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                まだ面接を実施していません
              </p>
              <Link href="/recruiter/agents">
                <Button>エージェント一覧を見る</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {recentSessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{s.agent.user.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(s.createdAt).toLocaleDateString("ja-JP")} ・{" "}
                      {s.messages.length}メッセージ
                    </p>
                  </div>
                  <Link href={`/recruiter/interview/${s.agent.id}`}>
                    <Button variant="outline" size="sm">
                      続ける
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
