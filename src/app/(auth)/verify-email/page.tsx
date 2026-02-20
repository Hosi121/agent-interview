"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const { data: session, update } = useSession();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const hasVerified = useRef(false);

  const handleVerify = useCallback(async () => {
    if (hasVerified.current) return;
    hasVerified.current = true;

    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (res.ok) {
        setStatus("success");
      } else {
        const data = await res.json();
        setStatus("error");
        setErrorMessage(data.error || "認証に失敗しました");
      }
    } catch {
      setStatus("error");
      setErrorMessage("認証に失敗しました");
    }
  }, [token]);

  // トークン検証
  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("認証トークンがありません");
      return;
    }
    handleVerify();
  }, [token, handleVerify]);

  // 認証成功後、セッションがあればJWTを更新してリダイレクト
  const hasRedirected = useRef(false);
  useEffect(() => {
    if (status !== "success" || !session || hasRedirected.current) return;
    hasRedirected.current = true;

    const redirectAfterUpdate = async () => {
      await update();
      // 完全リロードでmiddlewareが最新JWTを読み取れるようにする
      window.location.href = "/setup/passkey";
    };
    redirectAfterUpdate();
  }, [status, session, update]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-[400px] text-center space-y-6">
        <Image
          src="/logos/symbol+type.svg"
          alt="MeTalk"
          width={156}
          height={42}
          className="h-9 w-auto mx-auto"
          priority
        />

        {status === "loading" && (
          <div className="space-y-4">
            <div className="size-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">認証中...</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="size-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="size-8 text-green-600" />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-bold tracking-tight">
                認証が完了しました
              </h1>
              {session ? (
                <p className="text-sm text-muted-foreground">
                  メールアドレスの認証が完了しました。リダイレクトしています...
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  メールアドレスの認証が完了しました。ログインしてご利用ください。
                </p>
              )}
            </div>
            {!session && (
              <Button asChild className="w-full">
                <Link href="/login">ログインする</Link>
              </Button>
            )}
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="size-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="size-8 text-destructive" />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-bold tracking-tight">
                認証に失敗しました
              </h1>
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
            </div>
            <div className="space-y-2">
              <Button asChild variant="outline" className="w-full">
                <Link href="/check-email">認証メールを再送信</Link>
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link href="/login">ログインに戻る</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <div className="size-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
