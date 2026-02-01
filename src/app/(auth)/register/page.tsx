"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleUserRegister = async () => {
    if (!email.trim() || !password.trim() || !name.trim()) {
      setError("すべての項目を入力してください");
      return;
    }

    if (password !== confirmPassword) {
      setError("パスワードが一致しません");
      return;
    }

    if (password.length < 6) {
      setError("パスワードは6文字以上で入力してください");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name,
          accountType: "USER",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "登録に失敗しました");
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        throw new Error("ログインに失敗しました");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">アカウント登録</CardTitle>
          <CardDescription>
            求職者の登録のみ受け付けています。採用担当者の方は既存の管理者から
            招待をお受けいただくか、お問い合わせください。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">メールアドレス</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
              />
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
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="パスワードを再入力"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">お名前</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="山田 太郎"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive text-pretty" role="alert">
                {error}
              </p>
            )}
            <Button
              onClick={handleUserRegister}
              className="w-full"
              disabled={loading}
            >
              {loading ? "登録中..." : "求職者として登録"}
            </Button>
            <p className="text-xs text-muted-foreground text-center text-pretty">
              AIと対話してあなたのエージェントを作成し、
              採用担当者との面接を非同期で行えます
            </p>
            <p className="text-xs text-muted-foreground text-center text-pretty bg-gray-100 px-3 py-2 rounded-md">
              採用担当者の新規登録は現在招待制です。既存の管理者からの招待をお待ちいただくか、
              企業で初めてご利用の方はお問い合わせにてご相談ください。
            </p>
          </div>
          <div className="mt-4 text-center text-sm text-muted-foreground text-pretty">
            既にアカウントをお持ちの場合は
            <Link href="/login" className="text-primary hover:underline ml-1">
              ログイン
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">読み込み中...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
