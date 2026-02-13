"use client";

import { CloudUpload } from "lucide-react";
import { type DragEvent, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const ACCEPTED_EXTENSIONS = [".pdf", ".txt", ".md", ".docx"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface DocumentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (file: File) => Promise<void>;
}

export function DocumentUploadDialog({
  open,
  onOpenChange,
  onUpload,
}: DocumentUploadDialogProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open);
    if (!open) {
      setUploadError(null);
    }
  };

  const uploadFile = async (file: File) => {
    const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
    if (
      !ACCEPTED_TYPES.includes(file.type) &&
      !ACCEPTED_EXTENSIONS.includes(ext)
    ) {
      setUploadError(
        "対応していないファイル形式です。PDF、TXT、MD、DOCXのみアップロードできます。",
      );
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setUploadError("ファイルサイズは10MB以下にしてください。");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      await onUpload(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch {
      setUploadError("アップロードに失敗しました");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
  };

  const handleDragOver = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  };

  const handleDrop = async (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;
    await uploadFile(file);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ドキュメントをアップロード</DialogTitle>
          <DialogDescription>
            PDF、テキスト、Markdown、Word（docx）ファイルをアップロードできます
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <button
            type="button"
            aria-label="ファイルを選択またはドラッグ&ドロップ"
            onClick={() => !isUploading && fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            disabled={isUploading}
            className={cn(
              "flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors",
              isDragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
              isUploading && "pointer-events-none opacity-50",
              !isUploading && "cursor-pointer",
            )}
          >
            <div className="rounded-full bg-muted p-3">
              <CloudUpload className="size-6 text-muted-foreground" />
            </div>
            {isUploading ? (
              <p className="text-sm text-muted-foreground text-pretty">
                アップロード中...
              </p>
            ) : (
              <div className="text-center">
                <p className="text-sm font-medium">
                  クリックまたはドラッグ&ドロップ
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, TXT, MD, DOCX（最大10MB）
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md,.docx"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="hidden"
            />
          </button>
          {uploadError && (
            <p className="text-sm text-destructive text-pretty" role="alert">
              {uploadError}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
