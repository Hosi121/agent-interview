"use client";

import { CloudUpload, FileText, Plus, Trash2 } from "lucide-react";
import {
  type DragEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type AnalysisStatus = "PENDING" | "ANALYZING" | "COMPLETED" | "FAILED";

const ACCEPTED_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const ACCEPTED_EXTENSIONS = [".pdf", ".txt", ".md", ".docx"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface Document {
  id: string;
  fileName: string;
  summary: string | null;
  analysisStatus: AnalysisStatus;
  analysisError: string | null;
  analyzedAt: string | null;
  createdAt: string;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());

  const fetchDocuments = useCallback(async () => {
    try {
      const response = await fetch("/api/documents");
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    return () => {
      for (const es of eventSourcesRef.current.values()) {
        es.close();
      }
    };
  }, []);

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
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      await fetchDocuments();
      setIsDialogOpen(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // アップロード完了後、自動で解析を開始
      handleAnalyze(data.document.id).catch(() => {});
    } catch (error) {
      console.error("Upload error:", error);
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

  const handleDelete = async (id: string) => {
    setDeleteError(null);
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setDocuments((prev) => prev.filter((doc) => doc.id !== id));
        setDeleteTarget(null);
      } else {
        const data = await response.json();
        setDeleteError(data.error || "削除に失敗しました");
      }
    } catch (error) {
      console.error("Delete error:", error);
      setDeleteError("削除に失敗しました");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAnalyze = async (id: string) => {
    try {
      const response = await fetch(`/api/documents/${id}/analyze`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "解析の開始に失敗しました");
      }

      // サーバーから最新状態を取得（ANALYZING に遷移済み）
      await fetchDocuments();

      // SSE 接続
      const es = new EventSource(`/api/documents/${id}/analyze/stream`);
      eventSourcesRef.current.set(id, es);

      es.addEventListener("completed", (event) => {
        const data = JSON.parse(event.data);
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === id
              ? {
                  ...doc,
                  analysisStatus: "COMPLETED" as AnalysisStatus,
                  summary: data.summary,
                  analyzedAt: data.analyzedAt,
                  analysisError: null,
                }
              : doc,
          ),
        );
        es.close();
        eventSourcesRef.current.delete(id);
      });

      es.addEventListener("failed", (event) => {
        const data = JSON.parse(event.data);
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === id
              ? {
                  ...doc,
                  analysisStatus: "FAILED" as AnalysisStatus,
                  analysisError: data.error,
                }
              : doc,
          ),
        );
        es.close();
        eventSourcesRef.current.delete(id);
      });

      es.onerror = () => {
        es.close();
        eventSourcesRef.current.delete(id);
        fetchDocuments();
      };
    } catch (error) {
      console.error("Analyze error:", error);
      await fetchDocuments();
    }
  };

  const renderStatus = (doc: Document) => {
    switch (doc.analysisStatus) {
      case "ANALYZING":
        return (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 animate-pulse">
            解析中
          </span>
        );
      case "COMPLETED":
        return (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600">
            解析済み
          </span>
        );
      case "FAILED":
        return (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-destructive/10 text-destructive">
              エラー
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-3"
              onClick={() => handleAnalyze(doc.id)}
            >
              再試行
            </Button>
          </div>
        );
      default:
        return (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs px-3"
            onClick={() => handleAnalyze(doc.id)}
          >
            解析する
          </Button>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            ドキュメント管理
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            履歴書やポートフォリオをアップロードして、エージェントに統合しましょう
          </p>
        </div>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open: boolean) => {
            setIsDialogOpen(open);
            if (!open) {
              setUploadError(null);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4 mr-2" />
              アップロード
            </Button>
          </DialogTrigger>
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
                <p
                  className="text-sm text-destructive text-pretty"
                  role="alert"
                >
                  {uploadError}
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="h-[2px] bg-gradient-to-r from-primary/60 via-primary to-primary/60" />
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="size-10 rounded-lg bg-secondary flex items-center justify-center">
              <FileText className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              まだドキュメントがありません
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              最初のドキュメントをアップロード
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b">
            <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
              ドキュメント
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {documents.length}件
            </p>
          </div>
          {documents.map((doc, index) => (
            <div
              key={doc.id}
              className={cn(
                "px-5 py-4 hover:bg-secondary/30 transition-colors",
                index < documents.length - 1 && "border-b",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <FileText className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{doc.fileName}</p>
                    <p className="text-[10px] text-muted-foreground tabular-nums">
                      {new Date(doc.createdAt).toLocaleDateString("ja-JP")}
                    </p>
                    {doc.summary && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {doc.summary}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    {renderStatus(doc)}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="ドキュメントを削除"
                      onClick={() => {
                        setDeleteTarget(doc);
                        setDeleteError(null);
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                  {doc.analysisStatus === "FAILED" && doc.analysisError && (
                    <p
                      className="text-xs text-destructive text-pretty tabular-nums"
                      role="alert"
                    >
                      {doc.analysisError}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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
            <AlertDialogTitle>ドキュメントを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              削除したドキュメントは元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                event.preventDefault();
                if (deleteTarget) {
                  handleDelete(deleteTarget.id);
                }
              }}
              disabled={isDeleting}
            >
              {isDeleting ? "削除中..." : "削除する"}
            </AlertDialogAction>
          </AlertDialogFooter>
          {deleteError && (
            <p className="text-xs text-destructive text-pretty" role="alert">
              {deleteError}
            </p>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
