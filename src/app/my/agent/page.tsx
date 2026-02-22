"use client";

import { useRouter } from "next/navigation";
import {
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AgentCardPanel,
  AgentPreviewDialog,
  FragmentList,
  SystemPromptEditor,
} from "@/components/agent";
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
  const router = useRouter();
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [fragments, setFragments] = useState<Fragment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [userName, setUserName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [savedSystemPrompt, setSavedSystemPrompt] = useState<string | null>(
    null,
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [cardPanelHeight, setCardPanelHeight] = useState<number | undefined>(
    undefined,
  );
  const [deleteTarget, setDeleteTarget] = useState<Fragment | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cardPanelRef = useRef<HTMLDivElement>(null);

  const fetchAgent = useCallback(async () => {
    try {
      const response = await fetch("/api/agents/me");
      if (response.ok) {
        const data = await response.json();
        setAgent(data.agent);
        setSavedSystemPrompt(data.agent?.systemPrompt ?? null);
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

  useEffect(() => {
    const el = cardPanelRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setCardPanelHeight(entry.borderBoxSize[0].blockSize);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleGeneratePrompt = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/agents/generate", {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        setAgent(data.agent);
        setSavedSystemPrompt(data.agent.systemPrompt);
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
        setSavedSystemPrompt(data.agent.systemPrompt);
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
        setSavedSystemPrompt(data.agent.systemPrompt);
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

  const handleDeleteFragment = async (id: string) => {
    setDeleteError(null);
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/fragments/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setFragments((prev) => prev.filter((f) => f.id !== id));
        setDeleteTarget(null);
      } else {
        try {
          const data = await response.json();
          setDeleteError(data.error || "削除に失敗しました");
        } catch {
          setDeleteError("削除に失敗しました");
        }
      }
    } catch (error) {
      console.error("Delete fragment error:", error);
      setDeleteError("削除に失敗しました");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCorrectFragment = (fragment: Fragment) => {
    router.push(`/my/chat?correctFragmentId=${fragment.id}`);
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
        <div
          ref={cardPanelRef}
          className="flex flex-col p-6 rounded-xl border bg-card gap-5"
        >
          <AgentCardPanel
            userName={userName}
            avatarUrl={avatarUrl}
            skills={allSkills}
            agentStatus={agent?.status}
            fragmentCount={fragments.length}
            skillCount={allSkills.length}
            isDragging={isDragging}
            isUploading={isUploading}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onFileSelect={handleFileSelect}
            fileInputRef={fileInputRef}
          />
        </div>

        {/* 右: システムプロンプト — 左パネルの高さに揃えてスクロール */}
        <div
          className="relative flex flex-col p-6 rounded-xl border bg-card gap-4 min-h-0 overflow-hidden"
          style={cardPanelHeight ? { height: cardPanelHeight } : undefined}
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/60 via-primary to-primary/60" />
          <SystemPromptEditor
            prompt={agent ? agent.systemPrompt : null}
            savedPrompt={savedSystemPrompt}
            onChange={(value) =>
              agent && setAgent({ ...agent, systemPrompt: value })
            }
            onSave={() => agent && handleUpdatePrompt(agent.systemPrompt)}
            onGenerate={handleGeneratePrompt}
            isGenerating={isGenerating}
          />
        </div>
      </div>

      {/* 記憶のかけら */}
      <div className="p-6 rounded-xl border bg-card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold tracking-tight">記憶のかけら</p>
            {fragments.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {fragments.length} 件
              </p>
            )}
          </div>
        </div>
        <FragmentList
          fragments={fragments}
          onDelete={(id) => {
            const target = fragments.find((f) => f.id === id);
            if (target) {
              setDeleteTarget(target);
              setDeleteError(null);
            }
          }}
          onCorrect={handleCorrectFragment}
        />
      </div>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>記憶のかけらを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              削除した記憶のかけらは元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteTarget && (
            <div className="p-3 bg-secondary rounded-lg text-sm">
              <p className="text-muted-foreground text-xs mb-1">
                {deleteTarget.type}
              </p>
              <p>{deleteTarget.content}</p>
            </div>
          )}
          {deleteError && (
            <p className="text-xs text-destructive text-pretty" role="alert">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                event.preventDefault();
                if (deleteTarget) {
                  handleDeleteFragment(deleteTarget.id);
                }
              }}
              disabled={isDeleting}
            >
              {isDeleting ? "削除中..." : "削除する"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AgentPreviewDialog
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        userName={userName}
        avatarPath={avatarUrl}
      />
    </div>
  );
}
