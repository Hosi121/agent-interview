"use client";

import { FileText, Plus } from "lucide-react";
import {
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type DocumentData,
  DocumentListItem,
  DocumentUploadDialog,
  type FragmentData,
} from "@/components/documents";
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

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<DocumentData | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());

  // Fragment 展開状態
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [documentFragments, setDocumentFragments] = useState<
    Record<string, FragmentData[]>
  >({});
  const [loadingFragmentsFor, setLoadingFragmentsFor] = useState<string | null>(
    null,
  );

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

  const fetchFragments = useCallback(async (docId: string) => {
    setLoadingFragmentsFor(docId);
    try {
      const response = await fetch(`/api/documents/${docId}/fragments`);
      if (response.ok) {
        const data = await response.json();
        setDocumentFragments((prev) => ({
          ...prev,
          [docId]: data.fragments,
        }));
      }
    } catch (error) {
      console.error("Failed to fetch fragments:", error);
    } finally {
      setLoadingFragmentsFor(null);
    }
  }, []);

  const handleToggleFragments = useCallback(
    (docId: string) => {
      if (expandedDocId === docId) {
        setExpandedDocId(null);
        return;
      }
      setExpandedDocId(docId);
      // キャッシュがなければ取得
      if (!documentFragments[docId]) {
        fetchFragments(docId);
      }
    },
    [expandedDocId, documentFragments, fetchFragments],
  );

  const handleAnalyze = async (id: string) => {
    try {
      const response = await fetch(`/api/documents/${id}/analyze`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "解析の開始に失敗しました");
      }

      await fetchDocuments();

      const es = new EventSource(`/api/documents/${id}/analyze/stream`);
      eventSourcesRef.current.set(id, es);

      es.addEventListener("completed", (event) => {
        const data = JSON.parse(event.data);
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === id
              ? {
                  ...doc,
                  analysisStatus: "COMPLETED" as const,
                  summary: data.summary,
                  analyzedAt: data.analyzedAt,
                  analysisError: null,
                  fragmentCount: data.fragmentCount ?? doc.fragmentCount,
                }
              : doc,
          ),
        );
        // Fragment キャッシュを無効化（再解析で内容が変わる可能性）
        setDocumentFragments((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setExpandedDocId((prev) => (prev === id ? null : prev));
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
                  analysisStatus: "FAILED" as const,
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
        // 展開状態・Fragment キャッシュのクリーンアップ
        setExpandedDocId((prev) => (prev === id ? null : prev));
        setDocumentFragments((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
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

  const handleUpload = async (file: File) => {
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

    // アップロード完了後、自動で解析を開始
    handleAnalyze(data.document.id).catch(() => {});
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
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="size-4 mr-2" />
          アップロード
        </Button>
      </div>

      <DocumentUploadDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onUpload={handleUpload}
      />

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
            <DocumentListItem
              key={doc.id}
              document={doc}
              isLast={index === documents.length - 1}
              onAnalyze={handleAnalyze}
              onDelete={(doc) => {
                setDeleteTarget(doc);
                setDeleteError(null);
              }}
              isExpanded={expandedDocId === doc.id}
              fragments={documentFragments[doc.id] ?? []}
              isLoadingFragments={loadingFragmentsFor === doc.id}
              onToggleFragments={handleToggleFragments}
            />
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
