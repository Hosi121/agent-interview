"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Settings {
  name: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
}

export default function SettingsPage() {
  const { update: updateSession } = useSession();
  const [settings, setSettings] = useState<Settings>({
    name: "",
    email: null,
    phone: null,
    avatarUrl: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isDeletingAvatar, setIsDeletingAvatar] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch("/api/applicant/settings");
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/applicant/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: settings.name,
          email: settings.email,
          phone: settings.phone,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSettings((prev) => ({ ...prev, ...data.settings }));
        setMessage({ type: "success", text: "設定を保存しました" });
      } else {
        const data = await response.json();
        setMessage({ type: "error", text: data.error || "保存に失敗しました" });
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      setMessage({ type: "error", text: "保存に失敗しました" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setMessage({
        type: "error",
        text: "ファイルサイズは5MB以下にしてください",
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setIsUploadingAvatar(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/applicant/avatar", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setSettings((prev) => ({ ...prev, avatarUrl: data.avatarUrl }));
        setMessage({ type: "success", text: "アバター画像を更新しました" });
        await updateSession();
      } else {
        const data = await response.json();
        setMessage({
          type: "error",
          text: data.error || "アップロードに失敗しました",
        });
      }
    } catch (error) {
      console.error("Failed to upload avatar:", error);
      setMessage({ type: "error", text: "アップロードに失敗しました" });
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleAvatarDelete = async () => {
    setIsDeletingAvatar(true);
    setMessage(null);

    try {
      const response = await fetch("/api/applicant/avatar", {
        method: "DELETE",
      });

      if (response.ok) {
        setSettings((prev) => ({ ...prev, avatarUrl: null }));
        setMessage({ type: "success", text: "アバター画像を削除しました" });
        await updateSession();
      } else {
        const data = await response.json();
        setMessage({
          type: "error",
          text: data.error || "削除に失敗しました",
        });
      }
    } catch (error) {
      console.error("Failed to delete avatar:", error);
      setMessage({ type: "error", text: "削除に失敗しました" });
    } finally {
      setIsDeletingAvatar(false);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-pretty">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-balance">設定</h1>
        <p className="text-muted-foreground mt-2 text-pretty">
          プロフィールと連絡先の設定
        </p>
      </div>

      {message && (
        <div
          className={cn(
            "p-4 rounded-lg text-pretty",
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200",
          )}
          role={message.type === "error" ? "alert" : "status"}
        >
          {message.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>プロフィール</CardTitle>
          <CardDescription>
            基本的なプロフィール情報を設定します
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6">
            <Avatar className="size-20">
              <AvatarImage src={settings.avatarUrl ?? undefined} />
              <AvatarFallback className="text-2xl">
                {settings.name?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isUploadingAvatar || isDeletingAvatar}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploadingAvatar ? "アップロード中..." : "画像を変更"}
                </Button>
                {settings.avatarUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isUploadingAvatar || isDeletingAvatar}
                    onClick={handleAvatarDelete}
                  >
                    {isDeletingAvatar ? "削除中..." : "削除"}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground text-pretty">
                JPEG、PNG、WebP、GIF（5MB以下）
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">名前</Label>
            <Input
              id="name"
              value={settings.name}
              onChange={(e) =>
                setSettings({ ...settings, name: e.target.value })
              }
              placeholder="山田 太郎"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>連絡先情報</CardTitle>
          <CardDescription>
            企業から興味を持たれた際に開示される連絡先情報です。
            連絡先を設定しておくと、企業とのコミュニケーションがスムーズになります。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス（連絡先開示用）</Label>
            <Input
              id="email"
              type="email"
              value={settings.email || ""}
              onChange={(e) =>
                setSettings({ ...settings, email: e.target.value || null })
              }
              placeholder="example@email.com"
            />
            <p className="text-xs text-muted-foreground text-pretty">
              企業に開示するメールアドレスです。ログイン用のメールアドレスとは別に設定できます。
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">電話番号（任意）</Label>
            <Input
              id="phone"
              type="tel"
              value={settings.phone || ""}
              onChange={(e) =>
                setSettings({ ...settings, phone: e.target.value || null })
              }
              placeholder="090-1234-5678"
            />
            <p className="text-xs text-muted-foreground text-pretty">
              企業に開示する電話番号です。設定は任意です。
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex gap-2">
              <svg
                className="size-5 text-amber-600 shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-800 text-balance">
                  連絡先開示について
                </p>
                <p className="text-xs text-amber-700 mt-1 text-pretty">
                  企業があなたに興味を持ち、連絡先開示をリクエストした場合、
                  ここで設定した連絡先情報が企業に開示されます。
                  個人情報の取り扱いにご注意ください。
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "保存中..." : "設定を保存"}
        </Button>
      </div>
    </div>
  );
}
