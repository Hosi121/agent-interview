"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface DirectMessage {
  id: string;
  content: string;
  senderType: "USER" | "RECRUITER";
  createdAt: string;
  recruiter: { companyName: string } | null;
  user: { name: string } | null;
}

export interface DirectMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  messages: DirectMessage[];
  messageContent: string;
  onMessageContentChange: (value: string) => void;
  onSend: () => void;
  isSending: boolean;
  messageError: string | null;
  /** Which senderType represents "me" (the current user). Defaults to "USER". */
  mySenderType?: "USER" | "RECRUITER";
  /** Whether to show the message input area. Defaults to true. */
  showInput?: boolean;
  /** Empty state content when there are no messages */
  emptyState?: React.ReactNode;
}

export function DirectMessageDialog({
  open,
  onOpenChange,
  title,
  description,
  messages,
  messageContent,
  onMessageContentChange,
  onSend,
  isSending,
  messageError,
  mySenderType = "USER",
  showInput = true,
  emptyState,
}: DirectMessageDialogProps) {
  const defaultEmptyState = (
    <div className="flex flex-col items-center justify-center py-8 space-y-2">
      <div className="size-8 rounded-lg bg-secondary flex items-center justify-center">
        <svg
          className="size-4 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      </div>
      <p className="text-sm text-muted-foreground">
        まだメッセージはありません
      </p>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-80 border rounded-lg p-4">
          {messages.length === 0 ? (
            (emptyState ?? defaultEmptyState)
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex",
                    message.senderType === mySenderType
                      ? "justify-end"
                      : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-4 py-2",
                      message.senderType === mySenderType
                        ? "bg-primary text-white"
                        : "bg-secondary",
                    )}
                  >
                    <p className="text-sm text-pretty">{message.content}</p>
                    <p
                      className={cn(
                        "text-xs mt-1 tabular-nums",
                        message.senderType === mySenderType
                          ? "text-white/70"
                          : "text-muted-foreground",
                      )}
                    >
                      {new Date(message.createdAt).toLocaleString("ja-JP")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {showInput && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Textarea
                placeholder="メッセージを入力..."
                value={messageContent}
                onChange={(e) => onMessageContentChange(e.target.value)}
                className="flex-1"
                rows={2}
              />
              <Button
                onClick={onSend}
                disabled={isSending || !messageContent.trim()}
              >
                送信
              </Button>
            </div>
            {messageError && (
              <p className="text-xs text-destructive text-pretty" role="alert">
                {messageError}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
