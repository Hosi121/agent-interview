"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { RatingInput } from "./RatingInput";

interface EvaluationData {
  overallRating: number;
  technicalRating: number;
  communicationRating: number;
  cultureRating: number;
  comment: string;
}

interface EvaluationFormProps {
  initialData: EvaluationData;
  onSave: (data: EvaluationData) => Promise<void>;
}

export function EvaluationForm({ initialData, onSave }: EvaluationFormProps) {
  const [form, setForm] = useState<EvaluationData>(initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    try {
      await onSave(form);
      setSaveStatus({ type: "success", message: "評価を保存しました" });
    } catch (error) {
      console.error("Failed to save evaluation:", error);
      setSaveStatus({ type: "error", message: "保存に失敗しました" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <RatingInput
        label="総合評価"
        value={form.overallRating}
        onChange={(v) => setForm({ ...form, overallRating: v })}
      />
      <RatingInput
        label="技術力"
        value={form.technicalRating}
        onChange={(v) => setForm({ ...form, technicalRating: v })}
      />
      <RatingInput
        label="コミュニケーション"
        value={form.communicationRating}
        onChange={(v) => setForm({ ...form, communicationRating: v })}
      />
      <RatingInput
        label="カルチャーフィット"
        value={form.cultureRating}
        onChange={(v) => setForm({ ...form, cultureRating: v })}
      />
      <div className="space-y-1">
        <span className="text-sm font-medium">コメント</span>
        <Textarea
          value={form.comment}
          onChange={(e) => setForm({ ...form, comment: e.target.value })}
          placeholder="評価コメント..."
          className="min-h-[60px]"
        />
      </div>
      <Button
        onClick={handleSave}
        disabled={isSaving}
        className="h-8 text-xs px-3 w-full"
      >
        {isSaving ? "保存中..." : "評価を保存"}
      </Button>
      {saveStatus && (
        <p
          className={cn(
            "text-xs text-pretty",
            saveStatus.type === "error" ? "text-destructive" : "text-primary",
          )}
          role={saveStatus.type === "error" ? "alert" : undefined}
        >
          {saveStatus.message}
        </p>
      )}
    </div>
  );
}
