"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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

  const commonFields = (
    <>
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
    </>
  );

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">アカウント登録</CardTitle>
          <CardDescription>
            求職者または採用担当者として登録できます
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="user">求職者</TabsTrigger>
              <TabsTrigger value="recruiter">採用担当者</TabsTrigger>
            </TabsList>

            <TabsContent value="user" className="space-y-4 mt-4">
              {commonFields}
              <Button
                onClick={() => handleRegister("USER")}
                className="w-full"
                disabled={loading}
              >
                {loading ? "登録中..." : "求職者として登録"}
              </Button>
              <p className="text-xs text-muted-foreground text-center text-pretty">
                AIと対話してあなたのエージェントを作成し、
                採用担当者との面接を非同期で行えます
              </p>
            </TabsContent>

            <TabsContent value="recruiter" className="space-y-4 mt-4">
              {commonFields}
              <div className="space-y-2">
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
              <Button
                onClick={() => handleRegister("RECRUITER")}
                className="w-full"
                disabled={loading}
              >
                {loading ? "登録中..." : "採用担当者として登録"}
              </Button>
              <p className="text-xs text-muted-foreground text-center text-pretty">
                候補者のAIエージェントと対話し、 効率的な採用活動を行えます
              </p>
              <p className="text-xs text-muted-foreground text-center text-pretty bg-gray-100 px-3 py-2 rounded-md">
                既存の会社に参加する場合は、管理者からの招待リンクをご利用ください
              </p>
            </TabsContent>
          </Tabs>

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
