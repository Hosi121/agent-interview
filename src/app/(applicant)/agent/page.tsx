"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AgentBusinessCard,
  AgentPreviewDialog,
  FragmentList,
} from "@/components/agent";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface AgentProfile {
  id: string;
  systemPrompt: string;
  status: "PRIVATE" | "PUBLIC";
  createdAt: string;
  updatedAt: string;
}

interface Fragment {
  id: string;
  type: string;
  content: string;
  skills: string[];
  keywords: string[];
}

export default function AgentPage() {
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [fragments, setFragments] = useState<Fragment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [userName, setUserName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [cardPanelHeight, setCardPanelHeight] = useState<number | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cardPanelRef = useRef<HTMLDivElement>(null);

  const fetchAgent = useCallback(async () => {
    try {
      const response = await fetch("/api/agents/me");
      if (response.ok) {
        const data = await response.json();
        setAgent(data.agent);
        setFragments(data.fragments || []);
      }
    } catch (error) {
      console.error("Failed to fetch agent:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchUserProfile = useCallback(async () => {
    try {
      const response = await fetch("/api/applicant/settings");
      if (response.ok) {
        const data = await response.json();
        setUserName(data.settings.name);
        setAvatarUrl(data.settings.avatarUrl ?? null);
      }
    } catch (error) {
      console.error("Failed to fetch user profile:", error);
    }
  }, []);

  useEffect(() => {
    fetchAgent();
    fetchUserProfile();
  }, [fetchAgent, fetchUserProfile]);

  // 左パネルの高さを右パネルの上限として同期
  useEffect(() => {
    const el = cardPanelRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setCardPanelHeight(entry.borderBoxSize[0].blockSize);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [isLoading]);

  const handleGeneratePrompt = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/agents/generate", {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        setAgent(data.agent);
      }
    } catch (error) {
      console.error("Failed to generate prompt:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!agent) return;

    setIsUpdating(true);
    try {
      const newStatus = agent.status === "PRIVATE" ? "PUBLIC" : "PRIVATE";
      const response = await fetch("/api/agents/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        const data = await response.json();
        setAgent(data.agent);
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdatePrompt = async (newPrompt: string) => {
    if (!agent) return;

    try {
      const response = await fetch("/api/agents/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt: newPrompt }),
      });

      if (response.ok) {
        const data = await response.json();
        setAgent(data.agent);
      }
    } catch (error) {
      console.error("Failed to update prompt:", error);
    }
  };

  const uploadAvatar = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) return;
    if (!file.type.startsWith("image/")) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/applicant/avatar", {
        method: "POST",
        body: formData,
      });
      if (response.ok) {
        const data = await response.json();
        setAvatarUrl(data.avatarUrl);
      }
    } catch (error) {
      console.error("Failed to upload avatar:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadAvatar(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadAvatar(file);
    e.target.value = "";
  };

  const allSkills = [...new Set(fragments.flatMap((f) => f.skills))];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ヘッダー + アクション */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">エージェント</h1>
          <p className="text-sm text-muted-foreground mt-1">
            あなたを代理するAIエージェントの管理
          </p>
        </div>
        {agent && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPreviewOpen(true)}
            >
              テスト
            </Button>
            <Button
              size="sm"
              variant={agent.status === "PUBLIC" ? "destructive" : "default"}
              onClick={handleToggleStatus}
              disabled={isUpdating}
            >
              {isUpdating
                ? "更新中..."
                : agent.status === "PUBLIC"
                  ? "非公開にする"
                  : "公開する"}
            </Button>
          </div>
        )}
      </div>

      {/* 名刺 + プロンプト — 2カラム、高さ揃え */}
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* 左: 名刺カード + 統計 */}
        <div ref={cardPanelRef} className="flex flex-col p-6 rounded-xl border bg-card gap-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
              あなたの名刺
            </p>
            {agent?.status && (
              <span
                className={
                  agent.status === "PUBLIC"
                    ? "text-xs font-medium text-primary"
                    : "text-xs font-medium text-muted-foreground"
                }
              >
                {agent.status === "PUBLIC" ? "公開中" : "非公開"}
              </span>
            )}
          </div>
          <div
            className="flex items-center justify-center relative"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {/* ドラッグ中オーバーレイ */}
            {isDragging && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/5">
                <p className="text-sm font-medium text-primary">
                  画像をドロップ
                </p>
              </div>
            )}
            {/* アップロード中オーバーレイ */}
            {isUploading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-card/80">
                <div className="size-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
              </div>
            )}
            <div className="relative group">
              <AgentBusinessCard
                name={userName || "名前未設定"}
                avatarUrl={avatarUrl}
                skills={allSkills}
                status={agent?.status}
                fragmentCount={fragments.length}
              />
              {/* アバターエリアのクリックヒント */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute top-5 right-5 size-14 rounded-full cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity bg-foreground/40 flex items-center justify-center"
                aria-label="アバター画像を変更"
              >
                <svg
                  className="size-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
          {/* アバター未設定時のヒント */}
          {!avatarUrl && !isUploading && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 text-xs text-primary hover:underline mx-auto"
            >
              <svg
                className="size-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              写真を追加して名刺を完成させよう
            </button>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-2.5 rounded-lg bg-secondary/50">
              <p className="text-lg font-bold tabular-nums text-foreground">
                {fragments.length}
              </p>
              <p className="text-[10px] text-muted-foreground">記憶のかけら</p>
            </div>
            <div className="text-center p-2.5 rounded-lg bg-secondary/50">
              <p className="text-lg font-bold tabular-nums text-foreground">
                {allSkills.length}
              </p>
              <p className="text-[10px] text-muted-foreground">スキル</p>
            </div>
          </div>
        </div>

        {/* 右: システムプロンプト — 左パネルの高さに揃えてスクロール */}
        <div
          className="flex flex-col p-6 rounded-xl border bg-card gap-4 min-h-0 overflow-hidden"
          style={cardPanelHeight ? { height: cardPanelHeight } : undefined}
        >
          <div className="shrink-0">
            <p className="text-sm font-semibold tracking-tight">
              システムプロンプト
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              エージェントの振る舞いを定義します
            </p>
          </div>
          {agent ? (
            <>
              <Textarea
                value={agent.systemPrompt}
                onChange={(e) =>
                  setAgent({ ...agent, systemPrompt: e.target.value })
                }
                className="flex-1 min-h-0 text-sm resize-none"
                placeholder="エージェントのシステムプロンプト..."
              />
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUpdatePrompt(agent.systemPrompt)}
                >
                  保存
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGeneratePrompt}
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
              <Button
                size="sm"
                onClick={handleGeneratePrompt}
                disabled={isGenerating}
              >
                {isGenerating ? "生成中..." : "エージェントを生成"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 記憶のかけら */}
      <div className="p-6 rounded-xl border bg-card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold tracking-tight">
              記憶のかけら
            </p>
            {fragments.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {fragments.length} 件
              </p>
            )}
          </div>
        </div>
        <FragmentList fragments={fragments} />
      </div>

      <AgentPreviewDialog
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        userName={userName}
        avatarPath={avatarUrl}
      />
    </div>
  );
}
