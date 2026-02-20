"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import { useSession } from "next-auth/react";
import { useCallback, useState } from "react";

export function usePasskeyVerification() {
  const { update } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const verify = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      // 1. 認証オプションを取得
      const optionsRes = await fetch("/api/auth/passkey/authenticate/options", {
        method: "POST",
      });
      if (!optionsRes.ok) {
        const data = await optionsRes.json();
        throw new Error(data.error || "認証オプションの取得に失敗しました");
      }
      const options = await optionsRes.json();

      // 2. WebAuthnセレモニー実行
      const credential = await startAuthentication({ optionsJSON: options });

      // 3. サーバーで検証 → passkey_token Cookie が設定される
      const verifyRes = await fetch("/api/auth/passkey/authenticate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      if (!verifyRes.ok) {
        const data = await verifyRes.json();
        throw new Error(data.error || "パスキー認証に失敗しました");
      }

      // 4. 2FA完了トークンを取得 → passkey_2fa_verified Cookie が設定される
      const twoFaRes = await fetch("/api/auth/passkey/verify-2fa", {
        method: "POST",
      });
      if (!twoFaRes.ok) {
        const data = await twoFaRes.json();
        throw new Error(data.error || "2FA検証に失敗しました");
      }

      // 5. セッション更新（JWTコールバックでフラグクリア）
      await update();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "パスキー検証に失敗しました";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [update]);

  return { verify, loading, error };
}
