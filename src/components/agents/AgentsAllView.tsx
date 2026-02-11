"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
    avatarPath: string | null;
  };
  skills: string[];
  matchScore: number | null;
  matchReasons: string[];
}

interface Interest {
  id: string;
  agentId: string;
  status: string;
}

interface JobPosting {
  id: string;
  title: string;
  status: string;
}

interface AgentsAllViewProps {
  onSwitchToWatches: () => void;
}

export function AgentsAllView({ onSwitchToWatches }: AgentsAllViewProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [processingAgentId, setProcessingAgentId] = useState<string | null>(
    null,
  );
  const [interestErrors, setInterestErrors] = useState<Record<string, string>>(
    {},
  );

  const fetchJobs = useCallback(async () => {
    try {
      const response = await fetch("/api/recruiter/jobs");
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs.filter((j: JobPosting) => j.status === "ACTIVE"));
      }
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
    }
  }, []);

  const fetchAgents = useCallback(async (jobId?: string) => {
    try {
      setIsLoading(true);
      const url = jobId
        ? `/api/agents/public?jobId=${jobId}`
        : "/api/agents/public";
      const response = await fetch(url);
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
    fetchJobs();
  }, [fetchAgents, fetchInterests, fetchJobs]);

  useEffect(() => {
    fetchAgents(selectedJobId || undefined);
  }, [selectedJobId, fetchAgents]);

  const handleExpressInterest = async (agentId: string) => {
    setProcessingAgentId(agentId);
    setInterestErrors((prev) => ({ ...prev, [agentId]: "" }));
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
        setInterestErrors((prev) => ({
          ...prev,
          [agentId]: data.error || "エラーが発生しました",
        }));
      }
    } catch (error) {
      console.error("Failed to express interest:", error);
      setInterestErrors((prev) => ({
        ...prev,
        [agentId]: "エラーが発生しました",
      }));
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
    <>
      <div className="flex flex-wrap gap-4">
        <Input
          placeholder="名前で検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
        <select
          value={selectedJobId}
          onChange={(e) => setSelectedJobId(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm min-w-[200px]"
        >
          <option value="">すべてのエージェント</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.title}にマッチ
            </option>
          ))}
        </select>
        {selectedJobId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedJobId("")}
          >
            フィルターをクリア
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-pretty">読み込み中...</p>
        </div>
      ) : filteredAgents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <svg
              className="size-12 mx-auto text-muted-foreground mb-4"
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
            <p className="text-muted-foreground text-pretty">
              {searchQuery
                ? "検索条件に一致するエージェントがありません"
                : "現在公開されているエージェントはありません"}
            </p>
            <div className="mt-4">
              {searchQuery || selectedJobId ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedJobId("");
                  }}
                >
                  検索条件をクリア
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={onSwitchToWatches}>
                  ウォッチを作成
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAgents.map((agent) => (
            <Card key={agent.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <Avatar className="size-12">
                    {agent.user.avatarPath && (
                      <AvatarImage
                        src={`/api/applicant/avatar/${agent.user.avatarPath}`}
                        alt={agent.user.name}
                      />
                    )}
                    <AvatarFallback className="bg-primary text-white text-lg">
                      {agent.user.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle>{agent.user.name}</CardTitle>
                      {agent.matchScore !== null && (
                        <Badge
                          variant={
                            agent.matchScore >= 0.7
                              ? "default"
                              : agent.matchScore >= 0.4
                                ? "secondary"
                                : "outline"
                          }
                          className="tabular-nums"
                        >
                          {Math.round(agent.matchScore * 100)}%マッチ
                        </Badge>
                      )}
                    </div>
                    <CardDescription>
                      更新日:{" "}
                      <span className="tabular-nums">
                        {new Date(agent.updatedAt).toLocaleDateString("ja-JP")}
                      </span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {agent.skills && agent.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {agent.skills.slice(0, 5).map((skill) => (
                      <Badge key={skill} variant="outline" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {agent.skills.length > 5 && (
                      <Badge variant="outline" className="text-xs tabular-nums">
                        +{agent.skills.length - 5}
                      </Badge>
                    )}
                  </div>
                )}

                {agent.matchReasons && agent.matchReasons.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-2">
                    <p className="text-xs font-medium text-green-800 mb-1 text-balance">
                      推薦理由
                    </p>
                    <ul className="text-xs text-green-700 space-y-0.5 text-pretty">
                      {agent.matchReasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">公開中</Badge>
                    <div className="flex gap-2">
                      {(() => {
                        const interest = getInterestForAgent(agent.id);
                        if (interest) {
                          return (
                            <Badge variant="outline" className="py-1.5">
                              <svg
                                className="size-4 mr-1 text-red-500"
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
                              className="size-4 mr-1"
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
                      <Link
                        href={
                          selectedJobId
                            ? `/recruiter/interview/${agent.id}?jobId=${selectedJobId}`
                            : `/recruiter/interview/${agent.id}`
                        }
                      >
                        <Button>面接を始める</Button>
                      </Link>
                    </div>
                  </div>
                  {interestErrors[agent.id] && (
                    <p
                      className="text-xs text-destructive text-pretty"
                      role="alert"
                    >
                      {interestErrors[agent.id]}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
