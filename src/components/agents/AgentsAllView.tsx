"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());

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

  const allSkills = useMemo(() => {
    const counts = new Map<string, number>();
    for (const agent of agents) {
      for (const skill of agent.skills ?? []) {
        counts.set(skill, (counts.get(skill) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([skill]) => skill);
  }, [agents]);

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(skill)) {
        next.delete(skill);
      } else {
        next.add(skill);
      }
      return next;
    });
  };

  const filteredAgents = agents.filter((agent) => {
    if (!agent.user.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (selectedSkills.size > 0) {
      const agentSkills = new Set(agent.skills ?? []);
      for (const skill of selectedSkills) {
        if (!agentSkills.has(skill)) return false;
      }
    }
    return true;
  });

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
        {(selectedJobId || selectedSkills.size > 0) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedJobId("");
              setSelectedSkills(new Set());
            }}
          >
            フィルターをクリア
          </Button>
        )}
      </div>

      {allSkills.length > 0 && (
        <div className="rounded-lg border p-3 space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            スキルタグ
          </p>
          <div className="flex flex-wrap gap-1.5">
            {allSkills.map((skill) => (
              <button
                key={skill}
                type="button"
                onClick={() => toggleSkill(skill)}
                className={cn(
                  "text-xs px-2 py-0.5 rounded-md transition-colors",
                  selectedSkills.has(skill)
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                )}
              >
                {skill}
              </button>
            ))}
            {selectedSkills.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedSkills(new Set())}
                className="text-xs px-2 py-0.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                タグをクリア
              </button>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="size-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="text-center py-16">
          <div className="size-12 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
            <svg
              className="size-6 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">
            {searchQuery
              ? "検索条件に一致するエージェントがありません"
              : "現在公開されているエージェントはありません"}
          </p>
          <div className="mt-4">
            {searchQuery || selectedJobId || selectedSkills.size > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedJobId("");
                  setSelectedSkills(new Set());
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
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAgents.map((agent) => (
            <Card
              key={agent.id}
              className="group hover:border-primary/30 transition-colors"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Avatar className="size-11 ring-2 ring-border group-hover:ring-primary/20 transition-colors">
                    {agent.user.avatarPath && (
                      <AvatarImage
                        src={`/api/applicant/avatar/${agent.user.avatarPath}`}
                        alt={agent.user.name}
                      />
                    )}
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {agent.user.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm truncate">
                        {agent.user.name}
                      </CardTitle>
                      {agent.matchScore !== null && (
                        <span
                          className={cn(
                            "text-[10px] font-medium px-2 py-0.5 rounded-md tabular-nums shrink-0",
                            agent.matchScore >= 0.7
                              ? "bg-emerald-500/10 text-emerald-600"
                              : agent.matchScore >= 0.4
                                ? "bg-amber-500/10 text-amber-600"
                                : "bg-secondary text-secondary-foreground",
                          )}
                        >
                          {Math.round(agent.matchScore * 100)}%
                        </span>
                      )}
                    </div>
                    <CardDescription className="text-xs">
                      更新{" "}
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
                      <span
                        key={skill}
                        className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground"
                      >
                        {skill}
                      </span>
                    ))}
                    {agent.skills.length > 5 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground tabular-nums">
                        +{agent.skills.length - 5}
                      </span>
                    )}
                  </div>
                )}

                {agent.matchReasons && agent.matchReasons.length > 0 && (
                  <div className="bg-accent rounded-md p-2.5 border">
                    <p className="text-xs font-medium text-foreground mb-1">
                      推薦理由
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {agent.matchReasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  {(() => {
                    const interest = getInterestForAgent(agent.id);
                    if (interest) {
                      return (
                        <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                          <svg
                            className="size-3 mr-1"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                          </svg>
                          興味あり
                        </span>
                      );
                    }
                    return (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 px-2"
                        onClick={() => handleExpressInterest(agent.id)}
                        disabled={processingAgentId === agent.id}
                      >
                        <svg
                          className="size-3.5 mr-1"
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
                  <div className="flex-1" />
                  <Link
                    href={
                      selectedJobId
                        ? `/recruiter/interview/${agent.id}?jobId=${selectedJobId}`
                        : `/recruiter/interview/${agent.id}`
                    }
                  >
                    <Button size="sm" className="text-xs h-7">
                      面接を始める
                    </Button>
                  </Link>
                </div>
                {interestErrors[agent.id] && (
                  <p
                    className="text-xs text-destructive text-pretty"
                    role="alert"
                  >
                    {interestErrors[agent.id]}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
