"use client";

import { Mail } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const COOLDOWN_SECONDS = 60;

function CheckEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [cooldown, setCooldown] = useState(COOLDOWN_SECONDS);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = useCallback(async () => {
    if (!email || cooldown > 0) return;
    setSending(true);
    setMessage("");

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setMessage("認証メールを再送信しました");
        setCooldown(COOLDOWN_SECONDS);
      } else {
        const data = await res.json();
        setMessage(data.error || "再送信に失敗しました");
      }
    } catch {
      setMessage("再送信に失敗しました");
    } finally {
      setSending(false);
    }
  }, [email, cooldown]);

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

        <div className="flex justify-center">
          <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="size-8 text-primary" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight">
            メールを確認してください
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {email ? (
              <>
                <span className="font-medium text-foreground">{email}</span>
                <br />
                に認証メールを送信しました。
              </>
            ) : (
              "登録したメールアドレスに認証メールを送信しました。"
            )}
            <br />
            メール内のリンクをクリックして認証を完了してください。
          </p>
        </div>

        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full"
            disabled={cooldown > 0 || sending}
            onClick={handleResend}
          >
            {sending
              ? "送信中..."
              : cooldown > 0
                ? `再送信（${cooldown}秒後）`
                : "認証メールを再送信"}
          </Button>

          {message && (
            <p className="text-sm text-muted-foreground">{message}</p>
          )}
        </div>

        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            <Link href="/login" className="text-primary hover:underline">
              ログインに戻る
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <div className="size-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      }
    >
      <CheckEmailContent />
    </Suspense>
  );
}
