"use client";

import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect } from "react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { usePasskeyVerification } from "@/hooks/usePasskeyVerification";

function getDashboardPath(accountType: string | undefined) {
  return accountType === "RECRUITER" ? "/recruiter/dashboard" : "/my/dashboard";
}

export default function VerifyPasskeyPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { verify, loading, error } = usePasskeyVerification();

  const dashboardPath = getDashboardPath(session?.user?.accountType);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  // 検証不要ならダッシュボードへ（ミドルウェアでも制御されるがクライアント側でも対応）
  useEffect(() => {
    if (
      status === "authenticated" &&
      !session?.user?.passkeyVerificationRequired
    ) {
      router.replace(dashboardPath);
    }
  }, [
    status,
    session?.user?.passkeyVerificationRequired,
    dashboardPath,
    router,
  ]);

  const handleVerify = async () => {
    try {
      await verify();
      router.push(dashboardPath);
    } catch {
      // エラーはフック内で管理される
    }
  };

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  if (
    status === "loading" ||
    status === "unauthenticated" ||
    !session?.user?.passkeyVerificationRequired
  ) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AuthLayout>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">パスキーで本人確認</CardTitle>
          <CardDescription>
            セキュリティのため、登録済みのパスキーで追加認証を行ってください。指紋認証や顔認証など、お使いのデバイスの生体認証を利用します。
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
          <Button className="w-full" onClick={handleVerify} disabled={loading}>
            {loading ? "確認中..." : "パスキーで確認する"}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={handleLogout}
            disabled={loading}
          >
            ログアウト
          </Button>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
