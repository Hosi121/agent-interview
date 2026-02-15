import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface WatchNotification {
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

export interface WatchNotificationListProps {
  notifications: WatchNotification[];
  onMarkAsRead: (notificationId: string) => void;
}

export function WatchNotificationList({
  notifications,
  onMarkAsRead,
}: WatchNotificationListProps) {
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        通知
        {unreadCount > 0 && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-destructive text-destructive-foreground tabular-nums">
            {unreadCount}
          </span>
        )}
      </h2>

      <div className="rounded-xl border bg-card overflow-hidden">
        {notifications.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground text-center">
            通知はありません
          </p>
        ) : (
          notifications.map((notification, index) => (
            <div
              key={notification.id}
              className={cn(
                "p-4",
                index > 0 && "border-t",
                !notification.isRead && "bg-muted/50",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {notification.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
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
                    onClick={() => onMarkAsRead(notification.id)}
                  >
                    既読
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2 tabular-nums">
                {new Date(notification.createdAt).toLocaleDateString("ja-JP")}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
