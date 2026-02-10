"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
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

type Member = MemberSummary;

const roleLabel: Record<Member["role"], string> = {
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

  const handleToggleMemberStatus = async (member: Member) => {
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

  const handleDeleteMember = async (member: Member) => {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">メンバー管理</h1>
        <p className="text-muted-foreground text-pretty">
          会社アカウントのメンバー招待と権限管理を行います。2人目以降の採用担当者はここで招待リンクを作成し、メール等で共有してください。
        </p>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-8">読み込み中...</CardContent>
        </Card>
      ) : data ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{data.company.name}</CardTitle>
              <CardDescription>
                あなたの権限: {roleLabel[data.myRole]}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
              {message.type && (
                <div
                  className={`md:col-span-2 text-sm rounded-md px-3 py-2 ${message.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-destructive/10 text-destructive"}`}
                >
                  {message.text}
                </div>
              )}
              <div className="space-y-2">
                <p className="text-sm font-medium">現在のメンバー</p>
                <div className="space-y-3">
                  {data.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium">{member.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {roleLabel[member.role]}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{member.status}</Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={
                            !canInvite ||
                            updatingMemberId === member.id ||
                            deletingMemberId === member.id ||
                            member.status === "INVITED"
                          }
                          onClick={() => handleToggleMemberStatus(member)}
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
                          onClick={() => handleDeleteMember(member)}
                        >
                          {deletingMemberId === member.id
                            ? "削除中..."
                            : "削除（所属解除）"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">招待中</p>
                {data.invites.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    まだ招待はありません
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.invites.map((invite) => (
                      <div
                        key={invite.id}
                        className="rounded-lg border p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{invite.email}</p>
                            <p className="text-xs text-muted-foreground">
                              {roleLabel[invite.role as Member["role"]]}
                            </p>
                          </div>
                          <Badge variant="secondary">有効</Badge>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Input value={invite.acceptUrl} readOnly />
                          <Button
                            variant="outline"
                            onClick={() => handleCopy(invite.acceptUrl)}
                          >
                            コピー
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => handleCancelInvite(invite.id)}
                            disabled={cancelingInviteId === invite.id}
                          >
                            {cancelingInviteId === invite.id
                              ? "取消中..."
                              : "キャンセル"}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          有効期限:{" "}
                          {new Date(invite.expiresAt).toLocaleString("ja-JP")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

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
                  onChange={(e) =>
                    setRole(e.target.value as "ADMIN" | "MEMBER")
                  }
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
        </>
      ) : (
        <Card>
          <CardContent className="py-8 text-destructive">
            データの取得に失敗しました
          </CardContent>
        </Card>
      )}
    </div>
  );
}
