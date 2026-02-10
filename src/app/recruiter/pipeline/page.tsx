"use client";

import Link from "next/link";
import { type MouseEvent, useCallback, useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Pipeline {
  id: string;
  stage: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  agent: {
    id: string;
    user: {
      name: string;
      fragments: Array<{
        type: string;
        skills: string[];
        content: string;
      }>;
    };
  };
  job: {
    id: string;
    title: string;
  } | null;
}

interface Job {
  id: string;
  title: string;
}

const stageLabels: Record<string, string> = {
  INTERESTED: "興味あり",
  CONTACTED: "連絡済み",
  SCREENING: "書類選考",
  INTERVIEWING: "面接中",
  OFFER: "オファー",
  HIRED: "採用",
  REJECTED: "不採用",
  WITHDRAWN: "辞退",
};

const stageColors: Record<string, string> = {
  INTERESTED: "bg-blue-100 text-blue-800",
  CONTACTED: "bg-purple-100 text-purple-800",
  SCREENING: "bg-yellow-100 text-yellow-800",
  INTERVIEWING: "bg-orange-100 text-orange-800",
  OFFER: "bg-green-100 text-green-800",
  HIRED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
  WITHDRAWN: "bg-gray-100 text-gray-800",
};

const activeStages = [
  "INTERESTED",
  "CONTACTED",
  "SCREENING",
  "INTERVIEWING",
  "OFFER",
];

export default function PipelinePage() {
  const [grouped, setGrouped] = useState<Record<string, Pipeline[]>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [removeTarget, setRemoveTarget] = useState<Pipeline | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const fetchPipeline = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedJobId !== "all") {
        params.set("jobId", selectedJobId);
      }
      const res = await fetch(`/api/recruiter/pipeline?${params}`);
      if (res.ok) {
        const data = await res.json();
        setGrouped(data.grouped);
        setCounts(data.counts);
      }
    } catch (error) {
      console.error("Failed to fetch pipeline:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedJobId]);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/recruiter/jobs");
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs);
      }
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline]);

  const handleStageChange = async (pipelineId: string, newStage: string) => {
    try {
      const res = await fetch(`/api/recruiter/pipeline/${pipelineId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
      if (res.ok) {
        fetchPipeline();
      }
    } catch (error) {
      console.error("Failed to update stage:", error);
    }
  };

  const handleRemove = async (pipelineId: string) => {
    setIsRemoving(true);
    setRemoveError(null);
    try {
      const res = await fetch(`/api/recruiter/pipeline/${pipelineId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchPipeline();
        setRemoveTarget(null);
      } else {
        const data = await res.json();
        setRemoveError(data.error || "削除に失敗しました");
      }
    } catch (error) {
      console.error("Failed to remove from pipeline:", error);
      setRemoveError("削除に失敗しました");
    } finally {
      setIsRemoving(false);
    }
  };

  const totalActive = activeStages.reduce(
    (sum, stage) => sum + (counts[stage] || 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-balance">パイプライン</h1>
          <p className="text-muted-foreground mt-1 text-pretty tabular-nums">
            候補者の選考状況を管理します（アクティブ: {totalActive}名）
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedJobId} onValueChange={setSelectedJobId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="求人で絞り込み" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべての求人</SelectItem>
              {jobs.map((job) => (
                <SelectItem key={job.id} value={job.id}>
                  {job.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-pretty">読み込み中...</p>
      ) : (
        <div className="grid grid-cols-5 gap-4">
          {activeStages.map((stage) => (
            <div key={stage} className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-balance">
                  {stageLabels[stage]}
                  <Badge variant="secondary" className="ml-2 tabular-nums">
                    {counts[stage] || 0}
                  </Badge>
                </h3>
              </div>
              <div className="space-y-2 min-h-96 bg-muted/30 rounded-lg p-2">
                {(grouped[stage] || []).map((pipeline) => (
                  <Card key={pipeline.id} className="cursor-pointer">
                    <CardHeader className="p-3 pb-2">
                      <CardTitle className="text-sm font-medium">
                        {pipeline.agent.user.name}
                      </CardTitle>
                      {pipeline.job && (
                        <p className="text-xs text-muted-foreground text-pretty">
                          {pipeline.job.title}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="p-3 pt-0 space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {[
                          ...new Set(
                            pipeline.agent.user.fragments.flatMap(
                              (f) => f.skills,
                            ),
                          ),
                        ]
                          .slice(0, 3)
                          .map((skill) => (
                            <Badge
                              key={skill}
                              variant="outline"
                              className="text-xs"
                            >
                              {skill}
                            </Badge>
                          ))}
                      </div>
                      <Select
                        value={pipeline.stage}
                        onValueChange={(v: string) =>
                          handleStageChange(pipeline.id, v)
                        }
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(stageLabels).map(([k, v]) => (
                            <SelectItem key={k} value={k}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-1">
                        <Link
                          href={
                            pipeline.job
                              ? `/recruiter/interview/${pipeline.agent.id}?jobId=${pipeline.job.id}`
                              : `/recruiter/interview/${pipeline.agent.id}`
                          }
                          className="flex-1"
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs"
                          >
                            面接
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-destructive"
                          onClick={() => {
                            setRemoveTarget(pipeline);
                            setRemoveError(null);
                          }}
                        >
                          削除
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Archived/Closed stages */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4 text-balance">クローズド</h2>
        <div className="grid grid-cols-3 gap-4">
          {["HIRED", "REJECTED", "WITHDRAWN"].map((stage) => (
            <Card key={stage}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Badge className={stageColors[stage]}>
                    {stageLabels[stage]}
                  </Badge>
                  <span className="text-muted-foreground tabular-nums">
                    {counts[stage] || 0}名
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(grouped[stage] || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-pretty">
                    候補者がいません
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(grouped[stage] || []).slice(0, 3).map((pipeline) => (
                      <div
                        key={pipeline.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>{pipeline.agent.user.name}</span>
                        {pipeline.job && (
                          <span className="text-muted-foreground text-xs text-pretty">
                            {pipeline.job.title}
                          </span>
                        )}
                      </div>
                    ))}
                    {(grouped[stage] || []).length > 3 && (
                      <p className="text-xs text-muted-foreground tabular-nums">
                        他 {(grouped[stage] || []).length - 3}名
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setRemoveTarget(null);
            setRemoveError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>パイプラインから削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この候補者をパイプラインから外します。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                event.preventDefault();
                if (removeTarget) {
                  handleRemove(removeTarget.id);
                }
              }}
              disabled={isRemoving}
            >
              {isRemoving ? "削除中..." : "削除する"}
            </AlertDialogAction>
          </AlertDialogFooter>
          {removeError && (
            <p className="text-xs text-destructive text-pretty" role="alert">
              {removeError}
            </p>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
