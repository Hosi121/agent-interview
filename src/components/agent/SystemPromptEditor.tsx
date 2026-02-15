"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface SystemPromptEditorProps {
  prompt: string | null;
  onChange: (value: string) => void;
  onSave: () => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function SystemPromptEditor({
  prompt,
  onChange,
  onSave,
  onGenerate,
  isGenerating,
}: SystemPromptEditorProps) {
  return (
    <>
      <div className="shrink-0">
        <p className="text-sm font-semibold tracking-tight">
          システムプロンプト
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          エージェントの振る舞いを定義します
        </p>
      </div>
      {prompt !== null ? (
        <>
          <Textarea
            value={prompt}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 min-h-0 text-sm resize-none"
            placeholder="エージェントのシステムプロンプト..."
          />
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={onSave}>
              保存
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? "生成中..." : "再生成"}
            </Button>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center space-y-3 min-h-0">
          <div className="size-10 rounded-lg bg-secondary flex items-center justify-center">
            <svg
              className="size-5 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            AIチャットの情報からエージェントを生成します
          </p>
          <Button size="sm" onClick={onGenerate} disabled={isGenerating}>
            {isGenerating ? "生成中..." : "エージェントを生成"}
          </Button>
        </div>
      )}
    </>
  );
}
