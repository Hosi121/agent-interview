"use client";

import Link from "next/link";
import { type MouseEvent, useCallback, useEffect, useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  watch: {
    name: string;
  } | null;
  relatedAgent: {
    id: string;
    user: {
      name: string;
    };
  } | null;
}

const experienceLabels: Record<string, string> = {
  ENTRY: "未経験可",
  JUNIOR: "1-3年",
  MID: "3-5年",
  SENIOR: "5-10年",
  LEAD: "10年以上",
};

export default function WatchesPage() {
  const [watches, setWatches] = useState<Watch[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Watch | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newWatch, setNewWatch] = useState({
    name: "",
    skills: "",
    keywords: "",
    experienceLevel: "",
  });

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

  const handleCreateWatch = async () => {
    setIsCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/recruiter/watches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newWatch,
          skills: newWatch.skills
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          keywords: newWatch.keywords
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          experienceLevel: newWatch.experienceLevel || null,
        }),
      });

      if (res.ok) {
        setIsDialogOpen(false);
        setNewWatch({
          name: "",
          skills: "",
          keywords: "",
          experienceLevel: "",
        });
        fetchWatches();
      } else {
        const data = await res.json();
        setCreateError(data.error || "作成に失敗しました");
      }
    } catch (error) {
      console.error("Failed to create watch:", error);
      setCreateError("作成に失敗しました");
    } finally {
      setIsCreating(false);
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

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-balance">ウォッチリスト</h1>
          <p className="text-muted-foreground mt-1 text-pretty">
            条件に合う新規候補者を自動で通知します
          </p>
        </div>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setCreateError(null);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>新規ウォッチ作成</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>新規ウォッチ作成</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="name">ウォッチ名</Label>
                <Input
                  id="name"
                  value={newWatch.name}
                  onChange={(e) =>
                    setNewWatch({ ...newWatch, name: e.target.value })
                  }
                  placeholder="例: シニアバックエンド候補"
                />
              </div>
              <div>
                <Label htmlFor="skills">スキル（カンマ区切り）</Label>
                <Input
                  id="skills"
                  value={newWatch.skills}
                  onChange={(e) =>
                    setNewWatch({ ...newWatch, skills: e.target.value })
                  }
                  placeholder="例: TypeScript, Go, Kubernetes"
                />
              </div>
              <div>
                <Label htmlFor="keywords">キーワード（カンマ区切り）</Label>
                <Input
                  id="keywords"
                  value={newWatch.keywords}
                  onChange={(e) =>
                    setNewWatch({ ...newWatch, keywords: e.target.value })
                  }
                  placeholder="例: マイクロサービス, CI/CD"
                />
              </div>
              <div>
                <Label htmlFor="experienceLevel">経験レベル（任意）</Label>
                <select
                  id="experienceLevel"
                  value={newWatch.experienceLevel}
                  onChange={(e) =>
                    setNewWatch({
                      ...newWatch,
                      experienceLevel: e.target.value,
                    })
                  }
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">指定なし</option>
                  {Object.entries(experienceLabels).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                onClick={handleCreateWatch}
                className="w-full"
                disabled={isCreating}
              >
                {isCreating ? "作成中..." : "作成"}
              </Button>
              {createError && (
                <p
                  className="text-sm text-destructive text-pretty"
                  role="alert"
                >
                  {createError}
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Watches List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-balance tabular-nums">
            登録済みウォッチ ({watches.length})
          </h2>

          {isLoading ? (
            <p className="text-muted-foreground text-pretty">読み込み中...</p>
          ) : watches.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4 text-pretty">
                  まだウォッチがありません
                </p>
                <Button onClick={() => setIsDialogOpen(true)}>
                  最初のウォッチを作成
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {watches.map((watch) => (
                <Card key={watch.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {watch.name}
                          <Badge
                            variant={watch.isActive ? "default" : "secondary"}
                          >
                            {watch.isActive ? "アクティブ" : "停止中"}
                          </Badge>
                        </CardTitle>
                      </div>
                      <div className="flex gap-2">
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
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {watch.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-xs text-muted-foreground mr-1">
                            スキル:
                          </span>
                          {watch.skills.map((skill) => (
                            <Badge
                              key={skill}
                              variant="outline"
                              className="text-xs"
                            >
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {watch.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-xs text-muted-foreground mr-1">
                            キーワード:
                          </span>
                          {watch.keywords.map((keyword) => (
                            <Badge
                              key={keyword}
                              variant="secondary"
                              className="text-xs"
                            >
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {watch.experienceLevel && (
                        <p className="text-xs text-muted-foreground text-pretty">
                          経験レベル: {experienceLabels[watch.experienceLevel]}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground tabular-nums">
                        通知数: {watch._count.notifications}件
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-balance">
            通知
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2 tabular-nums">
                {unreadCount}
              </Badge>
            )}
          </h2>

          <Card>
            <CardContent className="p-0">
              {notifications.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center text-pretty">
                  通知はありません
                </p>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        "p-4",
                        !notification.isRead && "bg-muted/50",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {notification.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 text-pretty">
                            {notification.message}
                          </p>
                          {notification.relatedAgent && (
                            <Link
                              href={`/recruiter/interview/${notification.relatedAgent.id}`}
                              className="text-xs text-primary hover:underline mt-1 inline-block"
                            >
                              {notification.relatedAgent.user.name} を見る
                            </Link>
                          )}
                        </div>
                        {!notification.isRead && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs shrink-0"
                            onClick={() => handleMarkAsRead(notification.id)}
                          >
                            既読
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 tabular-nums">
                        {new Date(notification.createdAt).toLocaleDateString(
                          "ja-JP",
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
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
    </div>
  );
}
