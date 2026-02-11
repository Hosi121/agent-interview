"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h3 className="text-sm font-medium">求人内容</h3>
            </div>
            <div className="px-5 py-4 space-y-5">
              <div>
                <h4 className="font-medium mb-2 text-balance">詳細</h4>
                <p className="text-sm whitespace-pre-wrap text-pretty">
                  {job.description}
                </p>
              </div>
              {job.requirements && (
                <div>
                  <h4 className="font-medium mb-2 text-balance">必須要件</h4>
                  <p className="text-sm whitespace-pre-wrap text-pretty">
                    {job.requirements}
                  </p>
                </div>
              )}
              {job.preferredSkills && (
                <div>
                  <h4 className="font-medium mb-2 text-balance">歓迎スキル</h4>
                  <p className="text-sm whitespace-pre-wrap text-pretty">
                    {job.preferredSkills}
                  </p>
                </div>
              )}
              {job.skills.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 text-balance">必須スキル</h4>
                  <div className="flex flex-wrap gap-1">
                    {job.skills.map((skill) => (
                      <span
                        key={skill}
                        className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="matches" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground text-pretty tabular-nums">
              マッチした候補者: {job._count.matches}名
            </p>
            <Button onClick={handleRunMatching} disabled={isMatching}>
              {isMatching ? "計算中..." : "マッチング再計算"}
            </Button>
          </div>

          {job.matches.length === 0 ? (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="py-16 space-y-3 flex flex-col items-center text-center">
                <div className="size-10 rounded-lg bg-secondary flex items-center justify-center">
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
                      d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128H5.228A2 2 0 0 1 3.24 17.1a4.125 4.125 0 0 1 3.135-5.354M12.75 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm8.25 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
                    />
                  </svg>
                </div>
                <div className="h-px w-16 bg-gradient-to-r from-transparent via-border to-transparent" />
                <p className="text-muted-foreground text-sm text-pretty">
                  まだマッチング候補がいません
                </p>
                <Button onClick={handleRunMatching} disabled={isMatching}>
                  マッチングを実行
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b">
                <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
                  マッチ候補
                </span>
                <span className="text-[10px] tracking-widest text-muted-foreground ml-2 tabular-nums">
                  {job.matches.length}
                </span>
              </div>
              {job.matches.map((match, index) => (
                <div
                  key={match.id}
                  className={cn(
                    "px-5 py-4 hover:bg-secondary/30 transition-colors",
                    index < job.matches.length - 1 && "border-b",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{match.agent.user.name}</p>
                      <div className="flex gap-4 text-sm text-muted-foreground mt-1 tabular-nums">
                        <span>総合: {Math.round(match.score * 100)}%</span>
                        <span>
                          スキル: {Math.round(match.scoreDetails.skill * 100)}%
                        </span>
                        <span>
                          経験:{" "}
                          {Math.round(match.scoreDetails.experience * 100)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/recruiter/interview/${match.agent.id}?jobId=${jobId}`}
                      >
                        <Button variant="outline" size="sm">
                          面接
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        onClick={() => handleAddToPipeline(match.agent.id)}
                      >
                        パイプラインに追加
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
