import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { UnauthorizedError, ValidationError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { buildSetCookieHeader } from "@/lib/webauthn";

const VERIFIED_TOKEN_TTL_MS = 30 * 1000;

export const POST = withAuth(
  async (req, session) => {
    const { checkRateLimit, RATE_LIMIT_PRESETS } = await import(
      "@/lib/rate-limiter"
    );
    await checkRateLimit(req, RATE_LIMIT_PRESETS.PUBLIC_AUTH);

    const accountId = session.user.accountId;
    if (!accountId) {
      throw new UnauthorizedError();
    }

    // パスキー認証で設定された passkey_token Cookie を取得
    const cookieStore = await cookies();
    const passkeyToken = cookieStore.get("passkey_token")?.value;

    if (!passkeyToken) {
      throw new ValidationError(
        "パスキー認証トークンが見つかりません。再度お試しください。",
      );
    }

    // login_token をアトミック削除で検証
    const stored = await prisma.webAuthnChallenge
      .delete({
        where: {
          challenge: passkeyToken,
          type: "login_token",
          expiresAt: { gt: new Date() },
        },
      })
      .catch(() => null);

    if (!stored) {
      throw new ValidationError(
        "パスキー認証トークンが無効または期限切れです。再度お試しください。",
      );
    }

    // 使用済みのCookieを削除
    cookieStore.delete("passkey_token");

    // トークンのaccountIdがセッションのユーザーと一致するか確認
    if (stored.accountId !== accountId) {
      throw new ValidationError("認証情報が一致しません。再度お試しください。");
    }

    // 2FA検証完了のワンタイムトークンを生成
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const verifiedToken = isoBase64URL.fromBuffer(tokenBytes);

    await prisma.webAuthnChallenge.create({
      data: {
        accountId,
        challenge: verifiedToken,
        type: "2fa_verified",
        expiresAt: new Date(Date.now() + VERIFIED_TOKEN_TTL_MS),
      },
    });

    // httpOnly Cookie に2FA検証完了トークンを設定
    return new NextResponse(JSON.stringify({ verified: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": buildSetCookieHeader(
          "passkey_2fa_verified",
          verifiedToken,
          30,
        ),
      },
    });
  },
  { skip2faCheck: true },
);
