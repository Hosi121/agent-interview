"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface Agent {
  id: string;
  status: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
  };
}

interface Interest {
  id: string;
  agentId: string;
  status: string;
}

export default function AgentsListPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [processingAgentId, setProcessingAgentId] = useState<string | null>(
    null,
  );

  const fetchAgents = useCallback(async () => {
    try {
      const response = await fetch("/api/agents/public");
      if (response.ok) {
        const data = await response.json();
        setAgents(data.agents);
      }
    } catch (error) {
      console.error("Failed to fetch agents:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchInterests = useCallback(async () => {
    try {
      const response = await fetch("/api/interests");
      if (response.ok) {
        const data = await response.json();
        setInterests(data.interests);
      }
    } catch (error) {
      console.error("Failed to fetch interests:", error);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    fetchInterests();
  }, [fetchAgents, fetchInterests]);

  const handleExpressInterest = async (agentId: string) => {
    setProcessingAgentId(agentId);
    try {
      const response = await fetch("/api/interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });

      if (response.ok) {
        const data = await response.json();
        setInterests((prev) => [...prev, data.interest]);
      } else {
        const data = await response.json();
        alert(data.error || "エラーが発生しました");
      }
    } catch (error) {
      console.error("Failed to express interest:", error);
      alert("エラーが発生しました");
    } finally {
      setProcessingAgentId(null);
    }
  };

  const getInterestForAgent = (agentId: string) => {
    return interests.find((i) => i.agentId === agentId);
  };

  const filteredAgents = agents.filter((agent) =>
    agent.user.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">エージェント一覧</h1>
        <p className="text-muted-foreground mt-2">
          公開されているエージェントと面接を行えます
        </p>
      </div>

      <div className="flex gap-4">
        <Input
          placeholder="名前で検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      ) : filteredAgents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <svg
              className="w-12 h-12 mx-auto text-muted-foreground mb-4"
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
            <p className="text-muted-foreground">
              {searchQuery
                ? "検索条件に一致するエージェントがありません"
                : "現在公開されているエージェントはありません"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAgents.map((agent) => (
            <Card key={agent.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary text-white text-lg">
                      {agent.user.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle>{agent.user.name}</CardTitle>
                    <CardDescription>
                      更新日:{" "}
                      {new Date(agent.updatedAt).toLocaleDateString("ja-JP")}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">公開中</Badge>
                  <div className="flex gap-2">
                    {(() => {
                      const interest = getInterestForAgent(agent.id);
                      if (interest) {
                        return (
                          <Badge variant="outline" className="py-1.5">
                            <svg
                              className="w-4 h-4 mr-1 text-red-500"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                            </svg>
                            興味あり
                          </Badge>
                        );
                      }
                      return (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExpressInterest(agent.id)}
                          disabled={processingAgentId === agent.id}
                        >
                          <svg
                            className="w-4 h-4 mr-1"
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
                          興味あり
                        </Button>
                      );
                    })()}
                    <Link href={`/recruiter/interview/${agent.id}`}>
                      <Button>面接を始める</Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
