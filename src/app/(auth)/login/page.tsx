"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { Suspense, useState } from "react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePasskey } from "@/hooks/usePasskey";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [error, setError] = useState("");
  const { isPasskeyAvailable, authenticateWithPasskey } = usePasskey();

  const handlePasskeyLogin = async () => {
    setPasskeyLoading(true);
    setError("");

    try {
      await authenticateWithPasskey();

      if (callbackUrl) {
        router.push(callbackUrl);
      } else {
        const session = await getSession();
        if (session?.user?.accountType === "RECRUITER") {
          router.push("/recruiter/dashboard");
        } else {
          router.push("/my/dashboard");
        }
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "パスキー認証に失敗しました";
      setError(msg);
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("メールアドレスまたはパスワードが正しくありません");
      setLoading(false);
      return;
    }

    if (callbackUrl) {
      router.push(callbackUrl);
    } else {
      const session = await getSession();
      if (session?.user?.accountType === "RECRUITER") {
        router.push("/recruiter/dashboard");
      } else {
        router.push("/my/dashboard");
      }
    }
  };

  return (
    <AuthLayout maxWidth="360px">
      <div className="space-y-1 mb-8">
        <h1 className="text-xl font-bold tracking-tight">ログイン</h1>
        <p className="text-sm text-muted-foreground">
          メールアドレスとパスワードを入力してください
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            メールアドレス
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            パスワード
          </label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="********"
            required
            autoComplete="current-password"
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

        <Button
          type="submit"
          className="w-full"
          disabled={loading || passkeyLoading}
        >
          {loading ? "ログイン中..." : "ログイン"}
        </Button>
      </form>

      {isPasskeyAvailable && (
        <>
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                または
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={handlePasskeyLogin}
            disabled={loading || passkeyLoading}
          >
            {passkeyLoading ? "認証中..." : "パスキーでログイン"}
          </Button>
        </>
      )}

      <div className="mt-6 pt-6 border-t text-center">
        <p className="text-sm text-muted-foreground">
          アカウントをお持ちでない場合は
          <Link href="/register" className="text-primary hover:underline ml-1">
            新規登録
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">読み込み中...</div>}>
      <LoginForm />
    </Suspense>
  );
}
