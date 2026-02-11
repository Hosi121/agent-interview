"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  ACTIVE: "募集中",
  PAUSED: "一時停止",
  CLOSED: "募集終了",
};

const statusColors: Record<string, string> = {
  DRAFT: "bg-secondary text-secondary-foreground",
  ACTIVE: "bg-green-100 text-green-800",
  PAUSED: "bg-yellow-100 text-yellow-800",
  CLOSED: "bg-red-100 text-red-800",
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">求人管理</h1>
          <p className="text-muted-foreground mt-1">
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

      {isLoading ? (
        <p className="text-muted-foreground">読み込み中...</p>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">まだ求人がありません</p>
            <Button onClick={() => setIsDialogOpen(true)}>
              最初の求人を作成
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {jobs.map((job) => (
            <Card key={job.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {job.title}
                      <Badge className={statusColors[job.status]}>
                        {statusLabels[job.status]}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {employmentLabels[job.employmentType]} ・{" "}
                      {experienceLabels[job.experienceLevel]}
                      {job.location && ` ・ ${job.location}`}
                      {job.isRemote && " ・ リモート可"}
                    </CardDescription>
                  </div>
                  <Link href={`/recruiter/jobs/${job.id}`}>
                    <Button variant="outline" size="sm">
                      詳細
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                  {job.description}
                </p>
                {job.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {job.skills.map((skill) => (
                      <Badge key={skill} variant="secondary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>マッチ: {job._count.matches}件</span>
                  <span>パイプライン: {job._count.pipelines}件</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
