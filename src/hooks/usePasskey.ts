"use client";

import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { signIn } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

export function usePasskey() {
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(browserSupportsWebAuthn());
  }, []);

  const registerPasskey = useCallback(async (deviceName?: string) => {
    // 登録オプションを取得
    const optionsRes = await fetch("/api/auth/passkey/register/options", {
      method: "POST",
    });
    if (!optionsRes.ok) {
      const data = await optionsRes.json();
      throw new Error(data.error || "登録オプションの取得に失敗しました");
    }
    const options = await optionsRes.json();

    // ブラウザのWebAuthn APIでセレモニー実行
    const credential = await startRegistration({ optionsJSON: options });

    // サーバーで検証
    const verifyRes = await fetch("/api/auth/passkey/register/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential, deviceName }),
    });

    if (!verifyRes.ok) {
      const data = await verifyRes.json();
      throw new Error(data.error || "パスキーの登録に失敗しました");
    }

    return verifyRes.json();
  }, []);

  const authenticateWithPasskey = useCallback(async () => {
    // 認証オプションを取得
    const optionsRes = await fetch("/api/auth/passkey/authenticate/options", {
      method: "POST",
    });
    if (!optionsRes.ok) {
      const data = await optionsRes.json();
      throw new Error(data.error || "認証オプションの取得に失敗しました");
    }
    const options = await optionsRes.json();

    // ブラウザのWebAuthn APIでセレモニー実行
    const credential = await startAuthentication({ optionsJSON: options });

    // サーバーで検証 → httpOnly Cookieが設定される
    const verifyRes = await fetch("/api/auth/passkey/authenticate/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });

    if (!verifyRes.ok) {
      const data = await verifyRes.json();
      throw new Error(data.error || "パスキー認証に失敗しました");
    }

    // Cookie 経由でNextAuthのセッションを作成
    const result = await signIn("credentials", {
      passkeyLogin: "true",
      redirect: false,
    });

    if (result?.error) {
      throw new Error("セッションの作成に失敗しました");
    }

    return result;
  }, []);

  return {
    isSupported,
    registerPasskey,
    authenticateWithPasskey,
  };
}
