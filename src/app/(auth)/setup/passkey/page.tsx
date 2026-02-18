"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { usePasskey } from "@/hooks/usePasskey";

function getDashboardPath(accountType: string | undefined) {
  return accountType === "RECRUITER" ? "/recruiter/dashboard" : "/my/dashboard";
}

export default function SetupPasskeyPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { isPasskeyAvailable, registerPasskey } = usePasskey();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const dashboardPath = getDashboardPath(session?.user?.accountType);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/register");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated" && isPasskeyAvailable === false) {
      router.replace(dashboardPath);
    }
  }, [status, isPasskeyAvailable, dashboardPath, router]);

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

  if (!isPasskeyAvailable) {
    return null;
  }

  return (
    <AuthLayout>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">パスキーを設定しますか？</CardTitle>
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
    </AuthLayout>
  );
}
