"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const experienceLabels: Record<string, string> = {
  ENTRY: "未経験可",
  JUNIOR: "1-3年",
  MID: "3-5年",
  SENIOR: "5-10年",
  LEAD: "10年以上",
};

export interface CreateWatchFormData {
  name: string;
  skills: string[];
  keywords: string[];
  experienceLevel: string | null;
}

export interface CreateWatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateWatchFormData) => Promise<void>;
}

export function CreateWatchDialog({
  open,
  onOpenChange,
  onSubmit,
}: CreateWatchDialogProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    skills: "",
    keywords: "",
    experienceLevel: "",
  });

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open);
    if (!open) {
      setCreateError(null);
    }
  };

  const handleSubmit = async () => {
    setIsCreating(true);
    setCreateError(null);
    try {
      await onSubmit({
        name: formData.name,
        skills: formData.skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        keywords: formData.keywords
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        experienceLevel: formData.experienceLevel || null,
      });
      setFormData({
        name: "",
        skills: "",
        keywords: "",
        experienceLevel: "",
      });
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "作成に失敗しました",
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>新規ウォッチ作成</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <Label htmlFor="name">ウォッチ名</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="例: シニアバックエンド候補"
            />
          </div>
          <div>
            <Label htmlFor="skills">スキル（カンマ区切り）</Label>
            <Input
              id="skills"
              value={formData.skills}
              onChange={(e) =>
                setFormData({ ...formData, skills: e.target.value })
              }
              placeholder="例: TypeScript, Go, Kubernetes"
            />
          </div>
          <div>
            <Label htmlFor="keywords">キーワード（カンマ区切り）</Label>
            <Input
              id="keywords"
              value={formData.keywords}
              onChange={(e) =>
                setFormData({ ...formData, keywords: e.target.value })
              }
              placeholder="例: マイクロサービス, CI/CD"
            />
          </div>
          <div>
            <Label htmlFor="experienceLevel">経験レベル（任意）</Label>
            <select
              id="experienceLevel"
              value={formData.experienceLevel}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  experienceLevel: e.target.value,
                })
              }
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="">指定なし</option>
              {Object.entries(experienceLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <Button
            onClick={handleSubmit}
            className="w-full"
            disabled={isCreating}
          >
            {isCreating ? "作成中..." : "作成"}
          </Button>
          {createError && (
            <p className="text-sm text-destructive text-pretty" role="alert">
              {createError}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
