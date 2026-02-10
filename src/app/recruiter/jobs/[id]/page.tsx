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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    return <p className="text-muted-foreground text-pretty">読み込み中...</p>;
  }

  if (!job) {
    return (
      <p className="text-muted-foreground text-pretty">求人が見つかりません</p>
    );
  }

  return (
    <div className="space-y-6">
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
          <h1 className="text-3xl font-bold text-balance">{job.title}</h1>
          <p className="text-muted-foreground mt-1 text-pretty tabular-nums">
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
          <Card>
            <CardHeader>
              <CardTitle>求人内容</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                      <Badge key={skill} variant="secondary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
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
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4 text-pretty">
                  まだマッチング候補がいません
                </p>
                <Button onClick={handleRunMatching} disabled={isMatching}>
                  マッチングを実行
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {job.matches.map((match) => (
                <Card key={match.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{match.agent.user.name}</p>
                        <div className="flex gap-4 text-sm text-muted-foreground mt-1 tabular-nums">
                          <span>総合: {Math.round(match.score * 100)}%</span>
                          <span>
                            スキル: {Math.round(match.scoreDetails.skill * 100)}
                            %
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
                  </CardContent>
                </Card>
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
