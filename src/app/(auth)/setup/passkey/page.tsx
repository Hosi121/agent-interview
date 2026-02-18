"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { usePasskey } from "@/hooks/usePasskey";

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
            MeTalk
          </span>
        </div>
      </div>
    </div>
  );
}

function getDashboardPath(accountType: string | undefined) {
  return accountType === "RECRUITER" ? "/recruiter/dashboard" : "/my/dashboard";
}

export default function SetupPasskeyPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { isSupported, registerPasskey } = usePasskey();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const dashboardPath = getDashboardPath(session?.user?.accountType);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/register");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated" && isSupported === false) {
      router.replace(dashboardPath);
    }
  }, [status, isSupported, dashboardPath, router]);

  const handleRegisterPasskey = async () => {
    setLoading(true);
    setError("");

    try {
      await registerPasskey();
      router.push(dashboardPath);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "パスキーの登録に失敗しました",
      );
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!isSupported) {
    return null;
  }

  return (
    <div className="flex min-h-dvh">
      {/* ブランドパネル — デスクトップのみ */}
      <div className="hidden lg:flex lg:w-2/5 shrink-0 bg-secondary/60 border-r flex-col items-center justify-center gap-8 px-12">
        <div className="text-center space-y-3">
          <Image
            src="/logos/symbol+type.svg"
            alt="MeTalk"
            width={180}
            height={48}
            className="h-10 w-auto mx-auto"
            priority
          />
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

      {/* コンテンツパネル */}
      <div className="flex-1 flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-[400px]">
          {/* モバイルロゴ */}
          <div className="lg:hidden text-center mb-8">
            <Image
              src="/logos/symbol+type.svg"
              alt="MeTalk"
              width={156}
              height={42}
              className="h-9 w-auto mx-auto"
              priority
            />
            <p className="text-xs text-muted-foreground mt-1">
              AIエージェントによる非同期面接
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">
                パスキーを設定しますか？
              </CardTitle>
              <CardDescription>
                パスキーを使うと、パスワードなしで安全にログインできます。指紋認証や顔認証など、お使いのデバイスの生体認証を利用します。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {error && (
                <div
                  className="text-sm rounded-md px-3 py-2 bg-destructive/10 text-destructive"
                  role="alert"
                >
                  {error}
                </div>
              )}
              <Button
                className="w-full"
                onClick={handleRegisterPasskey}
                disabled={loading}
              >
                {loading ? "設定中..." : "パスキーを設定する"}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => router.push(dashboardPath)}
                disabled={loading}
              >
                あとで設定する
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
