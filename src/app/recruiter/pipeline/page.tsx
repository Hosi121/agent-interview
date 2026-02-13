"use client";

import { type MouseEvent, useCallback, useEffect, useState } from "react";
import { ClosedStagesSection, PipelineCard } from "@/components/pipeline";
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
  INTERESTED: "bg-blue-500/10 text-blue-600",
  CONTACTED: "bg-purple-500/10 text-purple-600",
  SCREENING: "bg-amber-500/10 text-amber-600",
  INTERVIEWING: "bg-orange-500/10 text-orange-600",
  OFFER: "bg-emerald-500/10 text-emerald-600",
  HIRED: "bg-emerald-500/10 text-emerald-600",
  REJECTED: "bg-destructive/10 text-destructive",
  WITHDRAWN: "bg-secondary text-secondary-foreground",
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
  const [removeTarget, setRemoveTarget] = useState<{ id: string } | null>(null);
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
          <h1 className="text-2xl font-bold tracking-tight">パイプライン</h1>
          <p className="text-sm text-muted-foreground mt-1">
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

      <div className="grid grid-cols-5 gap-4">
        {activeStages.map((stage) => (
          <div key={stage} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-balance">
                {stageLabels[stage]}
                <span className="ml-2 text-[10px] font-medium px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground tabular-nums">
                  {counts[stage] || 0}
                </span>
              </h3>
            </div>
            <div className="space-y-2 min-h-96 bg-muted/30 rounded-lg p-2">
              {(grouped[stage] || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                  <div className="size-10 rounded-full bg-gradient-to-b from-muted to-muted/50 flex items-center justify-center">
                    <svg
                      className="size-5 text-muted-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                      />
                    </svg>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    候補者がいません
                  </p>
                </div>
              ) : (
                (grouped[stage] || []).map((pipeline) => (
                  <PipelineCard
                    key={pipeline.id}
                    pipeline={pipeline}
                    stageLabels={stageLabels}
                    onStageChange={handleStageChange}
                    onRemoveClick={(p) => {
                      setRemoveTarget(p);
                      setRemoveError(null);
                    }}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <ClosedStagesSection
        grouped={grouped}
        counts={counts}
        stageLabels={stageLabels}
        stageColors={stageColors}
      />

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
