"use client";

import { Loader2, RefreshCw, Save, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface SystemPromptEditorProps {
  prompt: string | null;
  savedPrompt?: string | null;
  onChange: (value: string) => void;
  onSave: () => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function SystemPromptEditor({
  prompt,
  savedPrompt,
  onChange,
  onSave,
  onGenerate,
  isGenerating,
}: SystemPromptEditorProps) {
  const hasUnsavedChanges =
    prompt !== null && savedPrompt !== undefined && prompt !== savedPrompt;

  return (
    <>
      <div className="flex items-center justify-between shrink-0">
        <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
          システムプロンプト
        </p>
        {prompt !== null && (
          <Badge
            variant={hasUnsavedChanges ? "secondary" : "outline"}
            className="text-[10px]"
          >
            {hasUnsavedChanges ? "未保存" : "保存済み"}
          </Badge>
        )}
      </div>
      {prompt !== null ? (
        <>
          <div className="flex-1 flex flex-col min-h-0 gap-1.5">
            <Textarea
              value={prompt}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1 min-h-0 text-sm resize-none overflow-y-auto [field-sizing:fixed]"
              placeholder="エージェントのシステムプロンプト..."
            />
            <p className="text-[10px] tabular-nums text-muted-foreground text-right">
              {prompt.length.toLocaleString()} 文字
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant={hasUnsavedChanges ? "default" : "outline"}
              size="sm"
              onClick={onSave}
              disabled={!hasUnsavedChanges}
            >
              <Save className="size-3.5" />
              保存
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              {isGenerating ? "生成中..." : "再生成"}
            </Button>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center min-h-0">
          <div className="flex flex-col items-center gap-3 p-6 rounded-xl bg-secondary/30">
            <div className="size-10 rounded-lg bg-secondary flex items-center justify-center">
              <Sparkles className="size-5 text-muted-foreground" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium">エージェント未生成</p>
              <p className="text-xs text-muted-foreground">
                AIチャットの情報からエージェントを生成します
              </p>
            </div>
            <Button size="sm" onClick={onGenerate} disabled={isGenerating}>
              {isGenerating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              {isGenerating ? "生成中..." : "エージェントを生成"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
