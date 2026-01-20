"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  matchScore?: number | null;
  onSave: (data: EvaluationData) => Promise<void>;
}

export function EvaluationForm({
  initialData,
  matchScore,
  onSave,
}: EvaluationFormProps) {
  const [form, setForm] = useState<EvaluationData>(initialData);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(form);
      alert("評価を保存しました");
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
        <span className="text-sm">コメント</span>
        <Textarea
          value={form.comment}
          onChange={(e) => setForm({ ...form, comment: e.target.value })}
          placeholder="評価コメント..."
          className="min-h-[60px]"
        />
      </div>
      <Button onClick={handleSave} disabled={isSaving} className="w-full">
        {isSaving ? "保存中..." : "評価を保存"}
      </Button>
      {typeof matchScore === "number" && (
        <div className="p-3 bg-primary/10 rounded-lg">
          <p className="text-sm font-medium">AIマッチ度スコア</p>
          <p className="text-2xl font-bold text-primary">{matchScore}%</p>
        </div>
      )}
    </div>
  );
}
