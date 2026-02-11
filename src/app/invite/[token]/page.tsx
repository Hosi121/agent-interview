"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type InviteInfo = {
  email: string;
  role: string;
  companyName: string;
  expiresAt: string;
  status: string;
};

export default function InviteAcceptPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ token?: string }>();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"READY" | "INVALID" | "EXPIRED">(
    "READY",
  );

  useEffect(() => {
    const fetchInvite = async () => {
      if (!params?.token) {
        setStatus("INVALID");
        setError("招待が見つかりません");
        setLoading(false);
        return;
      }
      setLoading(true);
      const res = await fetch(`/api/invites/${params.token}`);
      const json = await res.json();
      if (res.ok) {
        setInfo(json);
        setStatus("READY");
      } else if (res.status === 410) {
        setStatus("EXPIRED");
        setError(json.error || "招待の有効期限が切れています");
      } else {
        setStatus("INVALID");
        setError(json.error || "招待が見つかりません");
      }
      setLoading(false);
    };
    fetchInvite();
  }, [params?.token]);

  const handleAccept = async () => {
    if (!info) return;
    if (!params?.token) {
      setError("招待が見つかりません");
      return;
    }
    if (!password.trim() || password.length < 6) {
      setError("パスワードは6文字以上で入力してください");
      return;
    }
    if (password !== confirm) {
      setError("パスワードが一致しません");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/invites/${params.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "招待の受諾に失敗しました");
      }
      const signInResult = await signIn("credentials", {
        email: info.email,
        password,
        redirect: false,
      });
      if (signInResult?.error) {
        throw new Error("ログインに失敗しました");
      }
      const redirect = searchParams.get("redirect") || "/recruiter/dashboard";
      router.push(redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "招待の受諾に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">招待を受け付ける</CardTitle>
          <CardDescription>
            会社アカウントへの招待を受諾し、パスワードを設定します
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-center text-muted-foreground">読み込み中...</p>
          ) : status !== "READY" ? (
            <p className="text-center text-destructive">{error}</p>
          ) : info ? (
            <>
              <div className="space-y-1">
                <p className="text-sm font-medium">会社名</p>
                <p className="text-sm text-muted-foreground">
                  {info.companyName}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">メールアドレス</p>
                <p className="text-sm text-muted-foreground">{info.email}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">付与される権限</p>
                <p className="text-sm text-muted-foreground">{info.role}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">パスワード</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6文字以上"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">パスワード確認</label>
                <Input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="パスワードを再入力"
                />
              </div>
              {error && (
                <p
                  className="text-sm text-destructive text-pretty"
                  role="alert"
                >
                  {error}
                </p>
              )}
              <Button
                className="w-full"
                onClick={handleAccept}
                disabled={submitting}
              >
                {submitting ? "登録中..." : "招待を受諾して登録"}
              </Button>
            </>
          ) : (
            <p className="text-center text-destructive">招待が見つかりません</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
