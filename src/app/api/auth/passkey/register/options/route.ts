import { generateRegistrationOptions } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { ConflictError, UnauthorizedError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  buildSetCookieHeader,
  CHALLENGE_TTL_MS,
  MAX_PASSKEYS_PER_ACCOUNT,
  rpID,
  rpName,
} from "@/lib/webauthn";

export const POST = withAuth(async (_req, session) => {
  const accountId = session.user.accountId;
  if (!accountId) {
    throw new UnauthorizedError("アカウント情報が取得できません");
  }

  const account = await prisma.account.findUniqueOrThrow({
    where: { id: accountId },
    include: { passkeys: true },
  });

  // パスキー登録数上限チェック
  if (account.passkeys.length >= MAX_PASSKEYS_PER_ACCOUNT) {
    throw new ConflictError(
      `パスキーの登録上限（${MAX_PASSKEYS_PER_ACCOUNT}件）に達しています`,
    );
  }

  // 期限切れチャレンジを削除（レスポンスをブロックしない）
  prisma.webAuthnChallenge
    .deleteMany({
      where: { expiresAt: { lt: new Date() } },
    })
    .catch((err) => {
      logger.warn("Failed to cleanup expired WebAuthn challenges", {
        error: err instanceof Error ? err.message : String(err),
      });
    });

  // webauthnUserId がなければ生成してAccountに保存
  let webauthnUserId = account.webauthnUserId;
  if (!webauthnUserId) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    webauthnUserId = isoBase64URL.fromBuffer(bytes);
    await prisma.account.update({
      where: { id: accountId },
      data: { webauthnUserId },
    });
  }

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: account.email,
    userID: isoBase64URL.toBuffer(webauthnUserId),
    attestationType: "none",
    excludeCredentials: account.passkeys.map((pk) => ({
      id: isoBase64URL.fromBuffer(pk.credentialId),
      transports: pk.transports as AuthenticatorTransport[],
    })),
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "preferred",
    },
  });

  // チャレンジをDBに保存
  const record = await prisma.webAuthnChallenge.create({
    data: {
      accountId,
      challenge: options.challenge,
      type: "registration",
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
  });

  // チャレンジIDをhttpOnly Cookieでクライアントにバインド
  const cookie = buildSetCookieHeader("webauthn_reg_challenge", record.id, 300);

  return new NextResponse(JSON.stringify(options), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookie,
    },
  });
});
