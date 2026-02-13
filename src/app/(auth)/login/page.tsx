"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function MiniCard() {
  return (
    <div
      className="relative w-[260px] aspect-[1.75/1] rounded-xl border bg-card p-5 flex flex-col justify-between overflow-hidden"
      style={{
        boxShadow: "0 4px 24px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.02)",
      }}
    >
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
      <div className="flex items-start justify-between">
        <div className="space-y-0.5">
          <p className="text-[9px] tracking-widest text-muted-foreground uppercase">
            Agent
          </p>
          <p className="text-sm font-bold tracking-tight text-foreground">
            Your Name
          </p>
          <p className="text-[10px] text-muted-foreground">Your Title</p>
        </div>
        <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-border">
          <span className="text-xs text-primary font-semibold">?</span>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-1">
          {["Skill 1", "Skill 2", "Skill 3"].map((s) => (
            <span
              key={s}
              className="text-[8px] px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground"
            >
              {s}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-end">
          <span className="text-[8px] tracking-widest text-muted-foreground/40 font-medium">
            Metalk
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

    const session = await getSession();
    if (session?.user?.accountType === "RECRUITER") {
      router.push("/recruiter/dashboard");
    } else {
      router.push("/dashboard");
    }
    router.refresh();
  };

  return (
    <div className="flex min-h-dvh">
      {/* ブランドパネル — デスクトップのみ */}
      <div className="hidden lg:flex lg:w-2/5 shrink-0 bg-secondary/60 border-r flex-col items-center justify-center gap-8 px-12">
        <div className="text-center space-y-3">
          <p className="text-2xl font-bold tracking-tight text-foreground">
            Metalk
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px]">
            あなたの代わりに
            <span className="text-primary font-medium">語る名刺</span>
            を。
          </p>
        </div>
        <div
          style={{
            perspective: "600px",
            animation: "card-float 6s ease-in-out infinite",
          }}
        >
          <div
            style={{
              animation: "card-rotate 10s ease-in-out infinite",
              transformStyle: "preserve-3d",
            }}
          >
            <MiniCard />
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground/50 tracking-widest uppercase">
          AI Agent Platform
        </p>
      </div>

      {/* フォームパネル */}
      <div className="flex-1 flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-[360px]">
          {/* モバイルロゴ */}
          <div className="lg:hidden text-center mb-8">
            <p className="text-xl font-bold tracking-tight text-foreground">
              Metalk
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              AIエージェントによる非同期面接
            </p>
          </div>

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
              <p className="text-sm text-destructive text-pretty" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "ログイン中..." : "ログイン"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t text-center">
            <p className="text-sm text-muted-foreground">
              アカウントをお持ちでない場合は
              <Link
                href="/register"
                className="text-primary hover:underline ml-1"
              >
                新規登録
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
