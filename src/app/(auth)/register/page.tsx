"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Suspense, useState } from "react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultTab =
    searchParams.get("tab") === "recruiter" ? "recruiter" : "user";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const validateForm = (isRecruiter: boolean) => {
    if (!email.trim() || !password.trim() || !name.trim()) {
      setError("すべての項目を入力してください");
      return false;
    }

    if (isRecruiter && !companyName.trim()) {
      setError("会社名を入力してください");
      return false;
    }

    if (password !== confirmPassword) {
      setError("パスワードが一致しません");
      return false;
    }

    if (password.length < 6) {
      setError("パスワードは6文字以上で入力してください");
      return false;
    }

    return true;
  };

  const handleRegister = async (accountType: "USER" | "RECRUITER") => {
    const isRecruiter = accountType === "RECRUITER";
    if (!validateForm(isRecruiter)) return;

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
          accountType,
          ...(isRecruiter && { companyName }),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "登録に失敗しました");
      }

      // 登録成功後に自動サインイン
      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInResult?.ok) {
        router.push("/check-email");
      } else {
        // サインイン失敗時はフォールバック
        router.push(`/check-email?email=${encodeURIComponent(email)}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const commonFields = (
    <>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">メールアドレス</label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
          autoComplete="email"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">パスワード</label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="6文字以上"
          autoComplete="new-password"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">パスワード確認</label>
        <Input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="パスワードを再入力"
          autoComplete="new-password"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">お名前</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="山田 太郎"
          autoComplete="name"
        />
      </div>
      {error && (
        <div
          className="text-sm rounded-md px-3 py-2 bg-destructive/10 text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}
    </>
  );

  return (
    <AuthLayout>
      <div className="space-y-1 mb-8">
        <h1 className="text-xl font-bold tracking-tight">アカウント登録</h1>
        <p className="text-sm text-muted-foreground">
          求職者または採用担当者として登録できます
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="user">求職者</TabsTrigger>
          <TabsTrigger value="recruiter">採用担当者</TabsTrigger>
        </TabsList>

        <TabsContent value="user" asChild>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleRegister("USER");
            }}
            className="space-y-4 mt-4"
          >
            {commonFields}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "登録中..." : "求職者として登録"}
            </Button>
            <p className="text-xs text-muted-foreground text-center text-pretty">
              AIと対話してあなたのエージェントを作成し、
              採用担当者との面接を非同期で行えます
            </p>
          </form>
        </TabsContent>

        <TabsContent value="recruiter" asChild>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleRegister("RECRUITER");
            }}
            className="space-y-4 mt-4"
          >
            {commonFields}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">会社名</label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="株式会社〇〇"
              />
              <p className="text-xs text-muted-foreground">
                会社の管理者（オーナー）として登録されます
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "登録中..." : "採用担当者として登録"}
            </Button>
            <p className="text-xs text-muted-foreground text-center text-pretty">
              候補者のAIエージェントと対話し、 効率的な採用活動を行えます
            </p>
            <p className="text-xs text-muted-foreground text-center text-pretty bg-secondary px-3 py-2 rounded-md">
              既存の会社に参加する場合は、管理者からの招待リンクをご利用ください
            </p>
          </form>
        </TabsContent>
      </Tabs>

      <div className="mt-6 pt-6 border-t text-center">
        <p className="text-sm text-muted-foreground">
          既にアカウントをお持ちの場合は
          <Link href="/login" className="text-primary hover:underline ml-1">
            ログイン
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <div className="size-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
