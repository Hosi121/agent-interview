"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface InboxInterest {
  id: string;
  status: "EXPRESSED" | "CONTACT_REQUESTED" | "CONTACT_DISCLOSED" | "DECLINED";
  message: string | null;
  createdAt: string;
  updatedAt: string;
  recruiter: {
    id: string;
    companyName: string;
  };
  lastMessage: {
    content: string;
    senderType: "USER" | "RECRUITER";
    createdAt: string;
  } | null;
  messageCount: number;
}

const statusStyles: Record<string, { label: string; className: string }> = {
  EXPRESSED: {
    label: "興味表明",
    className: "bg-primary/10 text-primary",
  },
  CONTACT_REQUESTED: {
    label: "リクエスト中",
    className: "bg-amber-500/10 text-amber-600",
  },
  CONTACT_DISCLOSED: {
    label: "開示済み",
    className: "bg-emerald-500/10 text-emerald-600",
  },
  DECLINED: {
    label: "辞退",
    className: "bg-muted text-muted-foreground",
  },
};

export interface InboxInterestCardProps {
  interest: InboxInterest;
  isLast: boolean;
  accessPreference: "NONE" | "ALLOW" | "DENY";
  onAccessPreferenceChange: (value: "NONE" | "ALLOW" | "DENY") => void;
  onApprove: (interestId: string) => void;
  onDecline: (interest: InboxInterest) => void;
  onOpenMessages: (interest: InboxInterest) => void;
  isUpdating: boolean;
  actionError?: string;
}

export function InboxInterestCard({
  interest,
  isLast,
  accessPreference,
  onAccessPreferenceChange,
  onApprove,
  onDecline,
  onOpenMessages,
  isUpdating,
  actionError,
}: InboxInterestCardProps) {
  return (
    <div
      className={cn(
        "px-5 py-4 hover:bg-secondary/30 transition-colors",
        !isLast && "border-b",
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar className="size-9 shrink-0 mt-0.5">
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
            {interest.recruiter.companyName[0]}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold truncate">
              {interest.recruiter.companyName}
            </h3>
            <span
              className={cn(
                "text-[10px] font-medium px-2 py-0.5 rounded-md shrink-0",
                statusStyles[interest.status]?.className,
              )}
            >
              {statusStyles[interest.status]?.label || interest.status}
            </span>
          </div>
          {interest.lastMessage ? (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {interest.lastMessage.senderType === "USER"
                ? "あなた"
                : interest.recruiter.companyName}
              : {interest.lastMessage.content}
            </p>
          ) : interest.message ? (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {interest.message}
            </p>
          ) : null}
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground tabular-nums">
            <span>
              {new Date(interest.createdAt).toLocaleDateString("ja-JP")}
            </span>
            {interest.messageCount > 0 && (
              <span>{interest.messageCount} 件</span>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
          {interest.status === "CONTACT_DISCLOSED" && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => onOpenMessages(interest)}
            >
              メッセージ
            </Button>
          )}
          {interest.status === "CONTACT_REQUESTED" && (
            <>
              <Select
                value={accessPreference}
                onValueChange={(value) =>
                  onAccessPreferenceChange(value as "NONE" | "ALLOW" | "DENY")
                }
              >
                <SelectTrigger className="h-8 text-xs w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">今回のみ</SelectItem>
                  <SelectItem value="ALLOW">自動許可</SelectItem>
                  <SelectItem value="DENY">自動拒否</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => onApprove(interest.id)}
                  disabled={isUpdating}
                >
                  開示する
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => onDecline(interest)}
                  disabled={isUpdating}
                >
                  辞退
                </Button>
              </div>
            </>
          )}
          {interest.status === "EXPRESSED" && (
            <span className="text-[10px] text-muted-foreground">
              リクエスト待ち
            </span>
          )}
          {interest.status === "DECLINED" && (
            <span className="text-[10px] text-muted-foreground">辞退済み</span>
          )}
        </div>
      </div>
      {actionError && (
        <p className="text-xs text-destructive mt-2 ml-12" role="alert">
          {actionError}
        </p>
      )}
    </div>
  );
}
