"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePasskey } from "@/hooks/usePasskey";

interface PasskeyItem {
  id: string;
  deviceName: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export function PasskeyManagement() {
  const { isPasskeyAvailable, registerPasskey } = usePasskey();
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchPasskeys = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/passkey");
      if (res.ok) {
        const data = await res.json();
        setPasskeys(data.passkeys);
      } else {
        setMessage({
          type: "error",
          text: "パスキー一覧の取得に失敗しました",
        });
      }
    } catch {
      setMessage({
        type: "error",
        text: "パスキー一覧の取得に失敗しました",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPasskeys();
  }, [fetchPasskeys]);

  const handleRegister = async () => {
    setIsRegistering(true);
    setMessage(null);
    try {
      await registerPasskey(deviceName || undefined);
      setDeviceName("");
      setMessage({ type: "success", text: "パスキーを登録しました" });
      await fetchPasskeys();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "パスキーの登録に失敗しました";
      setMessage({ type: "error", text: msg });
    } finally {
      setIsRegistering(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/auth/passkey/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMessage({ type: "success", text: "パスキーを削除しました" });
        await fetchPasskeys();
      } else {
        const data = await res.json();
        setMessage({
          type: "error",
          text: data.error || "削除に失敗しました",
        });
      }
    } catch {
      setMessage({ type: "error", text: "削除に失敗しました" });
    } finally {
      setDeletingId(null);
    }
  };

  if (!isPasskeyAvailable) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>パスキー</CardTitle>
        <CardDescription>
          パスキーを登録すると、指紋認証やFace
          IDでID入力なしにログインできます。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <div
            className={
              message.type === "success"
                ? "p-3 rounded-lg bg-green-50 text-green-800 border border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-800 text-sm"
                : "p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800 text-sm"
            }
            role={message.type === "error" ? "alert" : "status"}
          >
            {message.text}
          </div>
        )}

        {/* 登録済みパスキー一覧 */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">読み込み中...</p>
        ) : passkeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            登録済みのパスキーはありません
          </p>
        ) : (
          <div className="space-y-2">
            {passkeys.map((pk) => (
              <div
                key={pk.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">
                    {pk.deviceName || "名称未設定のパスキー"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    登録日: {new Date(pk.createdAt).toLocaleDateString("ja-JP")}
                    {pk.lastUsedAt && (
                      <>
                        {" "}
                        / 最終使用:{" "}
                        {new Date(pk.lastUsedAt).toLocaleDateString("ja-JP")}
                      </>
                    )}
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={deletingId === pk.id}
                    >
                      {deletingId === pk.id ? "削除中..." : "削除"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        パスキーを削除しますか？
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        「{pk.deviceName || "名称未設定のパスキー"}
                        」を削除します。このパスキーではログインできなくなります。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>キャンセル</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(pk.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        削除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}

        {/* パスキー登録フォーム */}
        <div className="flex gap-2 pt-2">
          <Input
            placeholder="パスキーの名前（例: MacBook Pro）"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            maxLength={100}
            className="flex-1"
          />
          <Button onClick={handleRegister} disabled={isRegistering}>
            {isRegistering ? "登録中..." : "パスキーを追加"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
