"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Job {
  id: string;
  title: string;
  description: string;
  skills: string[];
  employmentType: string;
  experienceLevel: string;
  location: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  isRemote: boolean;
  status: string;
  createdAt: string;
  _count: {
    matches: number;
    pipelines: number;
  };
}

const statusLabels: Record<string, string> = {
  DRAFT: "下書き",
  ACTIVE: "公開中",
  PAUSED: "一時停止",
  CLOSED: "終了",
};

const statusColors: Record<string, string> = {
  DRAFT: "bg-secondary text-secondary-foreground",
  ACTIVE: "bg-emerald-500/10 text-emerald-600",
  PAUSED: "bg-amber-500/10 text-amber-600",
  CLOSED: "bg-destructive/10 text-destructive",
};

const employmentLabels: Record<string, string> = {
  FULL_TIME: "正社員",
  CONTRACT: "契約社員",
  PART_TIME: "パートタイム",
  INTERNSHIP: "インターン",
  FREELANCE: "業務委託",
};

const experienceLabels: Record<string, string> = {
  ENTRY: "未経験可",
  JUNIOR: "1-3年",
  MID: "3-5年",
  SENIOR: "5-10年",
  LEAD: "10年以上",
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newJob, setNewJob] = useState({
    title: "",
    description: "",
    skills: "",
    employmentType: "FULL_TIME",
    experienceLevel: "MID",
    location: "",
    salaryMin: "",
    salaryMax: "",
    isRemote: false,
  });

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/recruiter/jobs");
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs);
      }
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleCreateJob = async () => {
    try {
      const res = await fetch("/api/recruiter/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newJob,
          skills: newJob.skills
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          salaryMin: newJob.salaryMin ? Number(newJob.salaryMin) : null,
          salaryMax: newJob.salaryMax ? Number(newJob.salaryMax) : null,
          status: "DRAFT",
        }),
      });

      if (res.ok) {
        setIsDialogOpen(false);
        setNewJob({
          title: "",
          description: "",
          skills: "",
          employmentType: "FULL_TIME",
          experienceLevel: "MID",
          location: "",
          salaryMin: "",
          salaryMax: "",
          isRemote: false,
        });
        fetchJobs();
      }
    } catch (error) {
      console.error("Failed to create job:", error);
    }
  };

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
          <h1 className="text-2xl font-bold tracking-tight">求人管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            求人を作成して候補者とマッチングしましょう
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>新規作成</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>新規求人作成</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="title">求人タイトル</Label>
                <Input
                  id="title"
                  value={newJob.title}
                  onChange={(e) =>
                    setNewJob({ ...newJob, title: e.target.value })
                  }
                  placeholder="例: バックエンドエンジニア"
                />
              </div>
              <div>
                <Label htmlFor="description">求人詳細</Label>
                <Textarea
                  id="description"
                  value={newJob.description}
                  onChange={(e) =>
                    setNewJob({ ...newJob, description: e.target.value })
                  }
                  placeholder="業務内容や求める人物像を記載"
                  rows={4}
                />
              </div>
              <div>
                <Label htmlFor="skills">必須スキル（カンマ区切り）</Label>
                <Input
                  id="skills"
                  value={newJob.skills}
                  onChange={(e) =>
                    setNewJob({ ...newJob, skills: e.target.value })
                  }
                  placeholder="例: TypeScript, React, Node.js"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>雇用形態</Label>
                  <Select
                    value={newJob.employmentType}
                    onValueChange={(v: string) =>
                      setNewJob({ ...newJob, employmentType: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(employmentLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>経験レベル</Label>
                  <Select
                    value={newJob.experienceLevel}
                    onValueChange={(v: string) =>
                      setNewJob({ ...newJob, experienceLevel: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(experienceLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="location">勤務地</Label>
                <Input
                  id="location"
                  value={newJob.location}
                  onChange={(e) =>
                    setNewJob({ ...newJob, location: e.target.value })
                  }
                  placeholder="例: 東京都渋谷区"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="salaryMin">年収下限（万円）</Label>
                  <Input
                    id="salaryMin"
                    type="number"
                    value={newJob.salaryMin}
                    onChange={(e) =>
                      setNewJob({ ...newJob, salaryMin: e.target.value })
                    }
                    placeholder="400"
                  />
                </div>
                <div>
                  <Label htmlFor="salaryMax">年収上限（万円）</Label>
                  <Input
                    id="salaryMax"
                    type="number"
                    value={newJob.salaryMax}
                    onChange={(e) =>
                      setNewJob({ ...newJob, salaryMax: e.target.value })
                    }
                    placeholder="800"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isRemote"
                  checked={newJob.isRemote}
                  onChange={(e) =>
                    setNewJob({ ...newJob, isRemote: e.target.checked })
                  }
                  className="h-4 w-4"
                />
                <Label htmlFor="isRemote">リモートワーク可</Label>
              </div>
              <Button onClick={handleCreateJob} className="w-full">
                作成
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {jobs.length === 0 ? (
        <div className="py-16 space-y-3 text-center">
          <div className="mx-auto w-full max-w-xs h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary">
            <svg
              className="size-5 text-muted-foreground"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0"
              />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">まだ求人がありません</p>
          <Button onClick={() => setIsDialogOpen(true)}>
            最初の求人を作成
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b">
            <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
              求人 {jobs.length}件
            </span>
          </div>
          {jobs.map((job, index) => (
            <Link
              key={job.id}
              href={cn("/recruiter/jobs/", job.id)}
              className={cn(
                "block px-5 py-4 hover:bg-secondary/30 transition-colors",
                index < jobs.length - 1 && "border-b",
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{job.title}</span>
                    <span
                      className={cn(
                        "text-[10px] font-medium px-2 py-0.5 rounded-md shrink-0",
                        statusColors[job.status],
                      )}
                    >
                      {statusLabels[job.status]}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {employmentLabels[job.employmentType]} ・{" "}
                    {experienceLabels[job.experienceLevel]}
                    {job.location && ` ・ ${job.location}`}
                    {job.isRemote && " ・ リモート可"}
                  </p>
                  {job.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {job.skills.map((skill) => (
                        <span
                          key={skill}
                          className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground shrink-0 pt-0.5">
                  <span>マッチ {job._count.matches}</span>
                  <span>パイプライン {job._count.pipelines}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
