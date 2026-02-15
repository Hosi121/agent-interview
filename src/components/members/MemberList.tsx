"use client";

import { Button } from "@/components/ui/button";
import type { MemberSummary } from "@/lib/types/recruiter";
import { cn } from "@/lib/utils";

const roleLabel: Record<MemberSummary["role"], string> = {
  OWNER: "オーナー",
  ADMIN: "管理者",
  MEMBER: "メンバー",
};

interface MemberListProps {
  members: MemberSummary[];
  canInvite: boolean;
  updatingMemberId: string | null;
  deletingMemberId: string | null;
  onToggleStatus: (member: MemberSummary) => void;
  onDelete: (member: MemberSummary) => void;
}

export function MemberList({
  members,
  canInvite,
  updatingMemberId,
  deletingMemberId,
  onToggleStatus,
  onDelete,
}: MemberListProps) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b bg-secondary/30">
        <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
          メンバー
        </span>
        <span className="text-[10px] text-muted-foreground ml-2">
          {members.length}
        </span>
      </div>
      {members.map((member, i) => (
        <div
          key={member.id}
          className={cn(
            "px-5 py-4 hover:bg-secondary/30 transition-colors flex items-center justify-between",
            i < members.length - 1 && "border-b",
          )}
        >
          <div className="space-y-1">
            <p className="font-medium text-sm">{member.email}</p>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-[10px] font-medium px-2 py-0.5 rounded-md",
                  member.role === "OWNER" && "bg-primary/10 text-primary",
                  member.role === "ADMIN" && "bg-amber-500/10 text-amber-600",
                  member.role === "MEMBER" &&
                    "bg-secondary text-secondary-foreground",
                )}
              >
                {roleLabel[member.role]}
              </span>
              <span
                className={cn(
                  "text-[10px] font-medium px-2 py-0.5 rounded-md",
                  member.status === "ACTIVE" &&
                    "bg-emerald-500/10 text-emerald-600",
                  member.status === "DISABLED" &&
                    "bg-secondary text-secondary-foreground",
                  member.status === "INVITED" && "bg-primary/10 text-primary",
                )}
              >
                {member.status}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={
                !canInvite ||
                updatingMemberId === member.id ||
                deletingMemberId === member.id ||
                member.status === "INVITED"
              }
              onClick={() => onToggleStatus(member)}
            >
              {updatingMemberId === member.id
                ? "更新中..."
                : member.status === "DISABLED"
                  ? "有効化"
                  : "無効化"}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={
                !canInvite ||
                deletingMemberId === member.id ||
                updatingMemberId === member.id
              }
              onClick={() => onDelete(member)}
            >
              {deletingMemberId === member.id
                ? "削除中..."
                : "削除（所属解除）"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
