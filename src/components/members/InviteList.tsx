"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { InviteSummary, MemberSummary } from "@/lib/types/recruiter";
import { cn } from "@/lib/utils";

const roleLabel: Record<MemberSummary["role"], string> = {
  OWNER: "オーナー",
  ADMIN: "管理者",
  MEMBER: "メンバー",
};

interface InviteListProps {
  invites: InviteSummary[];
  cancelingInviteId: string | null;
  onCopyUrl: (url: string) => void;
  onCancel: (inviteId: string) => void;
}

export function InviteList({
  invites,
  cancelingInviteId,
  onCopyUrl,
  onCancel,
}: InviteListProps) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b bg-secondary/30">
        <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
          招待
        </span>
        <span className="text-[10px] text-muted-foreground ml-2">
          {invites.length}
        </span>
      </div>
      {invites.length === 0 ? (
        <div className="px-5 py-8 text-sm text-muted-foreground">
          まだ招待はありません
        </div>
      ) : (
        invites.map((invite, i) => (
          <div
            key={invite.id}
            className={cn(
              "px-5 py-4 hover:bg-secondary/30 transition-colors space-y-2",
              i < invites.length - 1 && "border-b",
            )}
          >
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-medium text-sm">{invite.email}</p>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-[10px] font-medium px-2 py-0.5 rounded-md",
                      invite.role === "OWNER" && "bg-primary/10 text-primary",
                      invite.role === "ADMIN" &&
                        "bg-amber-500/10 text-amber-600",
                      invite.role === "MEMBER" &&
                        "bg-secondary text-secondary-foreground",
                    )}
                  >
                    {roleLabel[invite.role as MemberSummary["role"]]}
                  </span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                    有効
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input value={invite.acceptUrl} readOnly />
              <Button
                variant="outline"
                onClick={() => onCopyUrl(invite.acceptUrl)}
              >
                コピー
              </Button>
              <Button
                variant="ghost"
                onClick={() => onCancel(invite.id)}
                disabled={cancelingInviteId === invite.id}
              >
                {cancelingInviteId === invite.id ? "取消中..." : "キャンセル"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              有効期限: {new Date(invite.expiresAt).toLocaleString("ja-JP")}
            </p>
          </div>
        ))
      )}
    </div>
  );
}
