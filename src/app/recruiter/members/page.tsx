"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { InviteList, MemberList } from "@/components/members";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { MemberSummary, MembersResponse } from "@/lib/types/recruiter";
import { cn } from "@/lib/utils";

const roleLabel: Record<MemberSummary["role"], string> = {
  OWNER: "オーナー",
  ADMIN: "管理者",
  MEMBER: "メンバー",
};

export default function MemberManagementPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<MembersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancelingInviteId, setCancelingInviteId] = useState<string | null>(
    null,
  );
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error" | null;
    text: string;
  }>({
    type: null,
    text: "",
  });

  const canInvite = useMemo(
    () => data?.myRole === "OWNER" || data?.myRole === "ADMIN",
    [data?.myRole],
  );

  const fetchMembers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/recruiter/members");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleInvite = async () => {
    if (!email.trim()) {
      setMessage({ type: "error", text: "メールアドレスを入力してください" });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/recruiter/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "招待の作成に失敗しました");
      }
      setMessage({
        type: "success",
        text: `招待リンクを作成しました: ${json.acceptUrl}`,
      });
      setEmail("");
      await fetchMembers();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error ? error.message : "招待の作成に失敗しました",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setMessage({ type: "success", text: "招待リンクをコピーしました" });
    } catch (_error) {
      setMessage({ type: "error", text: "コピーに失敗しました" });
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    setCancelingInviteId(inviteId);
    try {
      const res = await fetch(`/api/recruiter/invites/${inviteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REVOKED" }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "招待のキャンセルに失敗しました");
      }
      setMessage({ type: "success", text: "招待をキャンセルしました" });
      await fetchMembers();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "招待のキャンセルに失敗しました",
      });
    } finally {
      setCancelingInviteId(null);
    }
  };

  const handleToggleMemberStatus = async (member: MemberSummary) => {
    if (!member.id) return;
    if (member.email && member.email === session?.user?.email) {
      setMessage({ type: "error", text: "自分自身は無効化できません" });
      return;
    }
    const nextStatus = member.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    setUpdatingMemberId(member.id);
    try {
      const res = await fetch(`/api/recruiter/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "メンバーの更新に失敗しました");
      }
      setMessage({
        type: "success",
        text:
          nextStatus === "DISABLED"
            ? "メンバーを無効化しました"
            : "メンバーを有効化しました",
      });
      await fetchMembers();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "メンバーの更新に失敗しました",
      });
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleDeleteMember = async (member: MemberSummary) => {
    if (!member.id) return;
    if (member.email && member.email === session?.user?.email) {
      setMessage({ type: "error", text: "自分自身は削除できません" });
      return;
    }
    const confirmed = window.confirm(
      `${member.email} を削除（所属解除）しますか？`,
    );
    if (!confirmed) return;
    setDeletingMemberId(member.id);
    try {
      const res = await fetch(`/api/recruiter/members/${member.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "メンバーの削除に失敗しました");
      }
      setMessage({
        type: "success",
        text: "メンバーを削除（所属解除）しました",
      });
      await fetchMembers();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "メンバーの削除に失敗しました",
      });
    } finally {
      setDeletingMemberId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">メンバー管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            会社アカウントのメンバー招待と権限管理を行います。
          </p>
        </div>
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-8 text-destructive">
            データの取得に失敗しました
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">メンバー管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data.company.name} - あなたの権限:{" "}
            <span
              className={cn(
                "text-[10px] font-medium px-2 py-0.5 rounded-md",
                data.myRole === "OWNER" && "bg-primary/10 text-primary",
                data.myRole === "ADMIN" && "bg-amber-500/10 text-amber-600",
                data.myRole === "MEMBER" &&
                  "bg-secondary text-secondary-foreground",
              )}
            >
              {roleLabel[data.myRole]}
            </span>
          </p>
        </div>
      </div>

      {message.type && (
        <div
          className={cn(
            "text-sm rounded-md px-3 py-2",
            message.type === "success"
              ? "bg-emerald-500/10 text-emerald-600"
              : "bg-destructive/10 text-destructive",
          )}
        >
          {message.text}
        </div>
      )}

      <MemberList
        members={data.members}
        canInvite={canInvite}
        updatingMemberId={updatingMemberId}
        deletingMemberId={deletingMemberId}
        onToggleStatus={handleToggleMemberStatus}
        onDelete={handleDeleteMember}
      />

      <InviteList
        invites={data.invites}
        cancelingInviteId={cancelingInviteId}
        onCopyUrl={handleCopy}
        onCancel={handleCancelInvite}
      />

      {/* 新しい招待を作成 */}
      <Card>
        <CardHeader>
          <CardTitle>新しい招待を作成</CardTitle>
          <CardDescription>
            2人目以降の採用担当者を追加します（自動メール送信はしません。生成されたリンクを共有してください）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">メールアドレス</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="recruiter@example.com"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">付与する権限</label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as "ADMIN" | "MEMBER")}
              disabled={!canInvite}
            >
              <option value="MEMBER">メンバー（閲覧/操作）</option>
              <option value="ADMIN">管理者（招待・設定可）</option>
            </select>
          </div>
          {!canInvite && (
            <p className="text-xs text-destructive">
              招待を作成できるのはオーナー/管理者のみです
            </p>
          )}
          <Button
            onClick={handleInvite}
            disabled={!canInvite || isSubmitting}
            className="w-full sm:w-auto"
          >
            {isSubmitting ? "作成中..." : "招待リンクを作成"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
