import { FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AnalysisStatus = "PENDING" | "ANALYZING" | "COMPLETED" | "FAILED";

export interface DocumentData {
  id: string;
  fileName: string;
  summary: string | null;
  analysisStatus: AnalysisStatus;
  analysisError: string | null;
  analyzedAt: string | null;
  createdAt: string;
}

export interface DocumentListItemProps {
  document: DocumentData;
  isLast: boolean;
  onAnalyze: (id: string) => void;
  onDelete: (document: DocumentData) => void;
}

function StatusBadge({
  document,
  onAnalyze,
}: {
  document: DocumentData;
  onAnalyze: (id: string) => void;
}) {
  switch (document.analysisStatus) {
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
            onClick={() => onAnalyze(document.id)}
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
          onClick={() => onAnalyze(document.id)}
        >
          解析する
        </Button>
      );
  }
}

export function DocumentListItem({
  document,
  isLast,
  onAnalyze,
  onDelete,
}: DocumentListItemProps) {
  return (
    <div
      className={cn(
        "px-5 py-4 hover:bg-secondary/30 transition-colors",
        !isLast && "border-b",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <FileText className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{document.fileName}</p>
            <p className="text-[10px] text-muted-foreground tabular-nums">
              {new Date(document.createdAt).toLocaleDateString("ja-JP")}
            </p>
            {document.summary && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {document.summary}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <StatusBadge document={document} onAnalyze={onAnalyze} />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="ドキュメントを削除"
              onClick={() => onDelete(document)}
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
          {document.analysisStatus === "FAILED" && document.analysisError && (
            <p
              className="text-xs text-destructive text-pretty tabular-nums"
              role="alert"
            >
              {document.analysisError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
