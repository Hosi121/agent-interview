"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type MouseEvent, useCallback, useEffect, useState } from "react";
import { JobDetailsTab, JobMatchesTab } from "@/components/jobs";
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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface Match {
  id: string;
  score: number;
  scoreDetails: {
    skill: number;
    keyword: number;
    experience: number;
  };
  agent: {
    id: string;
    user: {
      name: string;
    };
  };
}

interface Job {
  id: string;
  title: string;
  description: string;
  requirements: string | null;
  preferredSkills: string | null;
  skills: string[];
  keywords: string[];
  employmentType: string;
  experienceLevel: string;
  location: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  isRemote: boolean;
  status: string;
  matches: Match[];
  _count: {
    matches: number;
    pipelines: number;
    watches: number;
  };
}

const statusLabels: Record<string, string> = {
  DRAFT: "下書き",
  ACTIVE: "募集中",
  PAUSED: "一時停止",
  CLOSED: "募集終了",
};

const statusColorMap: Record<string, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-600",
  PAUSED: "bg-amber-500/10 text-amber-600",
  CLOSED: "bg-destructive/10 text-destructive",
  DRAFT: "bg-secondary text-secondary-foreground",
};

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMatching, setIsMatching] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/recruiter/jobs/${jobId}`);
      if (res.ok) {
        const data = await res.json();
        setJob(data.job);
      }
    } catch (error) {
      console.error("Failed to fetch job:", error);
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  const handleStatusChange = async (status: string) => {
    try {
      const res = await fetch(`/api/recruiter/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        fetchJob();
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const handleRunMatching = async () => {
    setIsMatching(true);
    try {
      const res = await fetch(`/api/recruiter/jobs/${jobId}/match`, {
        method: "POST",
      });
      if (res.ok) {
        fetchJob();
      }
    } catch (error) {
      console.error("Failed to run matching:", error);
    } finally {
      setIsMatching(false);
    }
  };

  const handleAddToPipeline = async (agentId: string) => {
    try {
      const res = await fetch("/api/recruiter/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, jobId }),
      });
      if (res.ok) {
        fetchJob();
      }
    } catch (error) {
      console.error("Failed to add to pipeline:", error);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/recruiter/jobs/${jobId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/recruiter/jobs");
      } else {
        const data = await res.json();
        setDeleteError(data.error || "削除に失敗しました");
      }
    } catch (error) {
      console.error("Failed to delete job:", error);
      setDeleteError("削除に失敗しました");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!job) {
    return (
      <p className="text-muted-foreground text-pretty">求人が見つかりません</p>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/recruiter/jobs"
              className="text-muted-foreground hover:text-foreground"
            >
              ← 求人一覧
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-balance">
              {job.title}
            </h1>
            <span
              className={cn(
                "text-[10px] font-medium px-2 py-0.5 rounded-md",
                statusColorMap[job.status] ||
                  "bg-secondary text-secondary-foreground",
              )}
            >
              {statusLabels[job.status] || job.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1 text-pretty tabular-nums">
            {job.location || "勤務地未設定"}
            {job.isRemote && " ・ リモート可"}
            {job.salaryMin &&
              job.salaryMax &&
              ` ・ ${job.salaryMin}〜${job.salaryMax}万円`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={job.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(statusLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              setDeleteDialogOpen(true);
              setDeleteError(null);
            }}
          >
            削除
          </Button>
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">求人詳細</TabsTrigger>
          <TabsTrigger value="matches" className="tabular-nums">
            マッチング ({job._count.matches})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <JobDetailsTab
            description={job.description}
            requirements={job.requirements}
            preferredSkills={job.preferredSkills}
            skills={job.skills}
          />
        </TabsContent>

        <TabsContent value="matches" className="space-y-4">
          <JobMatchesTab
            matches={job.matches}
            matchCount={job._count.matches}
            jobId={jobId}
            isMatching={isMatching}
            onRunMatching={handleRunMatching}
            onAddToPipeline={handleAddToPipeline}
          />
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open: boolean) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>求人を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              削除した求人は元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                event.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting}
            >
              {isDeleting ? "削除中..." : "削除する"}
            </AlertDialogAction>
          </AlertDialogFooter>
          {deleteError && (
            <p className="text-xs text-destructive text-pretty" role="alert">
              {deleteError}
            </p>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
