"use client";

import { type MouseEvent, useCallback, useEffect, useState } from "react";
import {
  CreateWatchDialog,
  type CreateWatchFormData,
} from "@/components/agents/CreateWatchDialog";
import {
  type WatchNotification,
  WatchNotificationList,
} from "@/components/agents/WatchNotificationList";
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
import { cn } from "@/lib/utils";

interface Watch {
  id: string;
  name: string;
  skills: string[];
  keywords: string[];
  experienceLevel: string | null;
  isActive: boolean;
  createdAt: string;
  _count: {
    notifications: number;
  };
}

const experienceLabels: Record<string, string> = {
  ENTRY: "未経験可",
  JUNIOR: "1-3年",
  MID: "3-5年",
  SENIOR: "5-10年",
  LEAD: "10年以上",
};

export function WatchesView() {
  const [watches, setWatches] = useState<Watch[]>([]);
  const [notifications, setNotifications] = useState<WatchNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Watch | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchWatches = useCallback(async () => {
    try {
      const res = await fetch("/api/recruiter/watches");
      if (res.ok) {
        const data = await res.json();
        setWatches(data.watches);
      }
    } catch (error) {
      console.error("Failed to fetch watches:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/recruiter/notifications?limit=10");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  }, []);

  useEffect(() => {
    fetchWatches();
    fetchNotifications();
  }, [fetchWatches, fetchNotifications]);

  const handleCreateWatch = async (data: CreateWatchFormData) => {
    const res = await fetch("/api/recruiter/watches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      setIsDialogOpen(false);
      fetchWatches();
    } else {
      const responseData = await res.json();
      throw new Error(responseData.error || "作成に失敗しました");
    }
  };

  const handleToggleActive = async (watchId: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/recruiter/watches/${watchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (res.ok) {
        fetchWatches();
      }
    } catch (error) {
      console.error("Failed to toggle watch:", error);
    }
  };

  const handleDeleteWatch = async (watchId: string) => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/recruiter/watches/${watchId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchWatches();
        setDeleteTarget(null);
      } else {
        const data = await res.json();
        setDeleteError(data.error || "削除に失敗しました");
      }
    } catch (error) {
      console.error("Failed to delete watch:", error);
      setDeleteError("削除に失敗しました");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await fetch("/api/recruiter/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: [notificationId] }),
      });
      fetchNotifications();
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground mt-1">
          条件に合う新規候補者を自動で通知します
        </p>
        <Button onClick={() => setIsDialogOpen(true)}>新規ウォッチ作成</Button>
      </div>

      <CreateWatchDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSubmit={handleCreateWatch}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Watches List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold tabular-nums">
            登録済みウォッチ ({watches.length})
          </h2>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="size-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : watches.length === 0 ? (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="py-12 text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  まだウォッチがありません
                </p>
                <Button onClick={() => setIsDialogOpen(true)}>
                  最初のウォッチを作成
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border bg-card overflow-hidden">
              {watches.map((watch, index) => (
                <div
                  key={watch.id}
                  className={cn("px-4 py-3", index > 0 && "border-t")}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {watch.name}
                        </p>
                        <span
                          className={cn(
                            "text-[10px] font-medium px-2 py-0.5 rounded-md shrink-0",
                            watch.isActive
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-secondary text-secondary-foreground",
                          )}
                        >
                          {watch.isActive ? "アクティブ" : "停止中"}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1.5">
                        {watch.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            <span className="text-xs text-muted-foreground mr-1">
                              スキル:
                            </span>
                            {watch.skills.map((skill) => (
                              <span
                                key={skill}
                                className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}
                        {watch.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            <span className="text-xs text-muted-foreground mr-1">
                              キーワード:
                            </span>
                            {watch.keywords.map((keyword) => (
                              <span
                                key={keyword}
                                className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground"
                              >
                                {keyword}
                              </span>
                            ))}
                          </div>
                        )}
                        {watch.experienceLevel && (
                          <p className="text-xs text-muted-foreground">
                            経験レベル:{" "}
                            {experienceLabels[watch.experienceLevel]}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground tabular-nums">
                          通知数: {watch._count.notifications}件
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleToggleActive(watch.id, watch.isActive)
                        }
                      >
                        {watch.isActive ? "停止" : "有効化"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => {
                          setDeleteTarget(watch);
                          setDeleteError(null);
                        }}
                      >
                        削除
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <WatchNotificationList
          notifications={notifications}
          onMarkAsRead={handleMarkAsRead}
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
            <AlertDialogTitle>ウォッチを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              削除したウォッチは元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                event.preventDefault();
                if (deleteTarget) {
                  handleDeleteWatch(deleteTarget.id);
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
    </>
  );
}
