"use client";

import { AgentBusinessCard } from "./AgentBusinessCard";

interface AgentCardPanelProps {
  userName: string;
  avatarUrl: string | null;
  skills: string[];
  agentStatus?: "PUBLIC" | "PRIVATE";
  fragmentCount: number;
  skillCount: number;
  isDragging: boolean;
  isUploading: boolean;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function AgentCardPanel({
  userName,
  avatarUrl,
  skills,
  agentStatus,
  fragmentCount,
  skillCount,
  isDragging,
  isUploading,
  onDrop,
  onDragOver,
  onDragLeave,
  onFileSelect,
  fileInputRef,
}: AgentCardPanelProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
          あなたの名刺
        </p>
        {agentStatus && (
          <span
            className={
              agentStatus === "PUBLIC"
                ? "text-xs font-medium text-primary"
                : "text-xs font-medium text-muted-foreground"
            }
          >
            {agentStatus === "PUBLIC" ? "公開中" : "非公開"}
          </span>
        )}
      </div>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: drop zone for avatar upload */}
      <div
        className="flex items-center justify-center relative"
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        {isDragging && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/5">
            <p className="text-sm font-medium text-primary">画像をドロップ</p>
          </div>
        )}
        {isUploading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-card/80">
            <div className="size-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        )}
        <div className="relative group">
          <AgentBusinessCard
            name={userName || "名前未設定"}
            avatarUrl={avatarUrl}
            skills={skills}
            status={agentStatus}
            fragmentCount={fragmentCount}
          />
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
          onChange={onFileSelect}
          className="hidden"
        />
      </div>
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
            {fragmentCount}
          </p>
          <p className="text-[10px] text-muted-foreground">記憶のかけら</p>
        </div>
        <div className="text-center p-2.5 rounded-lg bg-secondary/50">
          <p className="text-lg font-bold tabular-nums text-foreground">
            {skillCount}
          </p>
          <p className="text-[10px] text-muted-foreground">スキル</p>
        </div>
      </div>
    </>
  );
}
