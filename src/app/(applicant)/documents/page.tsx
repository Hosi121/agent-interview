"use client";

import {
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type AnalysisStatus = "PENDING" | "ANALYZING" | "COMPLETED" | "FAILED";

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

      await fetchDocuments();
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Upload error:", error);
      setUploadError("アップロードに失敗しました");
    } finally {
      setIsUploading(false);
    }
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

  const renderStatusBadge = (doc: Document) => {
    switch (doc.analysisStatus) {
      case "ANALYZING":
        return (
          <Badge variant="secondary" className="animate-pulse">
            解析中...
          </Badge>
        );
      case "COMPLETED":
        return <Badge variant="secondary">解析済み</Badge>;
      case "FAILED":
        return (
          <div className="flex items-center gap-2">
            <Badge variant="destructive">エラー</Badge>
            <Button
              variant="outline"
              size="sm"
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
            onClick={() => handleAnalyze(doc.id)}
          >
            解析する
          </Button>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-balance">ドキュメント管理</h1>
          <p className="text-muted-foreground mt-2 text-pretty">
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
              <svg
                className="size-4 mr-2"
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
              <Input
                type="file"
                accept=".pdf,.txt,.md,.docx"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
              {isUploading && (
                <p className="text-sm text-muted-foreground text-pretty">
                  アップロード中...
                </p>
              )}
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

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-pretty">読み込み中...</p>
        </div>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <svg
              className="size-12 mx-auto text-muted-foreground mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-muted-foreground mb-4 text-pretty">
              まだドキュメントがありません
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              最初のドキュメントをアップロード
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {documents.map((doc) => (
            <Card key={doc.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <svg
                        className="size-5 text-primary"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      {doc.fileName}
                    </CardTitle>
                    <CardDescription className="tabular-nums">
                      {new Date(doc.createdAt).toLocaleDateString("ja-JP")}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      {renderStatusBadge(doc)}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="ドキュメントを削除"
                        onClick={() => {
                          setDeleteTarget(doc);
                          setDeleteError(null);
                        }}
                      >
                        <svg
                          className="size-4 text-destructive"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
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
              </CardHeader>
              {doc.summary && (
                <CardContent>
                  <p className="text-sm text-muted-foreground text-pretty">
                    {doc.summary}
                  </p>
                </CardContent>
              )}
            </Card>
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
