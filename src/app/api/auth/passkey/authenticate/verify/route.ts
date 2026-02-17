import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { NextResponse } from "next/server";
import { withValidation } from "@/lib/api-utils";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { passkeyAuthVerifySchema } from "@/lib/validations";
import {
  buildSetCookieHeader,
  expectedOrigins,
  LOGIN_TOKEN_TTL_MS,
  parseCookie,
  rpID,
} from "@/lib/webauthn";

export const POST = withValidation(
  passkeyAuthVerifySchema,
  async (body, req) => {
    const credential = body.credential as unknown as AuthenticationResponseJSON;

    // CookieからチャレンジIDを取得してクライアントにバインド
    const cookieHeader = req.headers.get("cookie") || "";
    const challengeId = parseCookie(cookieHeader, "webauthn_challenge");

    if (!challengeId) {
      throw new ValidationError(
        "チャレンジが見つかりません。再度お試しください。",
      );
    }

    // チャレンジをアトミックに削除・取得（1回限り使用）
    const deleted = await prisma.webAuthnChallenge
      .delete({
        where: {
          id: challengeId,
          type: "authentication",
          expiresAt: { gt: new Date() },
        },
      })
      .catch(() => null);

    if (!deleted) {
      throw new NotFoundError(
        "チャレンジが見つかりません。再度お試しください。",
      );
    }

    // userHandle から Account を解決
    const userHandle = credential.response.userHandle;
    if (!userHandle) {
      throw new ValidationError("認証レスポンスにuserHandleが含まれていません");
    }

    const account = await prisma.account.findUnique({
      where: { webauthnUserId: userHandle },
    });

    if (!account) {
      throw new NotFoundError("アカウントが見つかりません");
    }

    // credentialId でパスキーを検索
    const credentialIdBytes = isoBase64URL.toBuffer(credential.id);
    const passkey = await prisma.passkey.findUnique({
      where: { credentialId: Buffer.from(credentialIdBytes) },
    });

    if (!passkey || passkey.accountId !== account.id) {
      throw new NotFoundError("パスキーが見つかりません");
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge: deleted.challenge,
        expectedOrigin: expectedOrigins,
        expectedRPID: rpID,
        credential: {
          id: isoBase64URL.fromBuffer(passkey.credentialId),
          publicKey: passkey.credentialPublicKey,
          counter: passkey.counter,
          transports: passkey.transports as AuthenticatorTransport[],
        },
      });
    } catch {
      throw new ValidationError("パスキーの検証に失敗しました");
    }

    if (!verification.verified) {
      throw new ValidationError("パスキーの検証に失敗しました");
    }

    // カウンター検証: カウンターが以前より進んでいない場合はクローン攻撃の可能性
    const newCounter = verification.authenticationInfo.newCounter;
    if (passkey.counter > 0 && newCounter <= passkey.counter) {
      logger.warn("WebAuthn counter decreased, possible cloned authenticator", {
        accountId: account.id,
        passkeyId: passkey.id,
        oldCounter: passkey.counter,
        newCounter,
      });
      throw new ValidationError(
        "認証器の整合性エラーが検出されました。セキュリティのため認証を拒否しました。",
      );
    }

    await prisma.passkey.update({
      where: { id: passkey.id },
      data: {
        counter: newCounter,
        lastUsedAt: new Date(),
      },
    });

    // ワンタイムログイントークン作成
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const loginToken = isoBase64URL.fromBuffer(tokenBytes);

    await prisma.webAuthnChallenge.create({
      data: {
        accountId: account.id,
        challenge: loginToken,
        type: "login_token",
        expiresAt: new Date(Date.now() + LOGIN_TOKEN_TTL_MS),
      },
    });

    // httpOnly Cookie にトークンを設定 + webauthn_challenge Cookieを削除
    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.append(
      "Set-Cookie",
      buildSetCookieHeader("passkey_token", loginToken, 30),
    );
    headers.append(
      "Set-Cookie",
      buildSetCookieHeader("webauthn_challenge", "", 0),
    );

    return new NextResponse(JSON.stringify({ verified: true }), {
      status: 200,
      headers,
    });
  },
);
