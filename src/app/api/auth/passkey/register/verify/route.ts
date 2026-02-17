import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { withAuthValidation } from "@/lib/api-utils";
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { passkeyRegisterVerifySchema } from "@/lib/validations";
import { buildSetCookieHeader, expectedOrigins, rpID } from "@/lib/webauthn";

export const POST = withAuthValidation(
  passkeyRegisterVerifySchema,
  async (body, _req, session) => {
    const accountId = session.user.accountId;
    if (!accountId) {
      throw new UnauthorizedError("アカウント情報が取得できません");
    }
    // simplewebauthnライブラリが内部でレスポンス構造をバリデーションするため、
    // Zodで基本構造を検証した後のtype castは安全
    const credential = body.credential as unknown as RegistrationResponseJSON;

    // CookieからチャレンジIDを取得してクライアントにバインド
    const cookieStore = await cookies();
    const challengeId = cookieStore.get("webauthn_reg_challenge")?.value;

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
          accountId,
          type: "registration",
          expiresAt: { gt: new Date() },
        },
      })
      .catch(() => null);

    if (!deleted) {
      throw new NotFoundError(
        "チャレンジが見つかりません。再度お試しください。",
      );
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge: deleted.challenge,
        expectedOrigin: expectedOrigins,
        expectedRPID: rpID,
      });
    } catch {
      throw new ValidationError("パスキーの検証に失敗しました");
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw new ValidationError("パスキーの検証に失敗しました");
    }

    const {
      credential: cred,
      credentialDeviceType,
      credentialBackedUp,
    } = verification.registrationInfo;

    await prisma.passkey.create({
      data: {
        accountId,
        credentialId: Buffer.from(isoBase64URL.toBuffer(cred.id)),
        credentialPublicKey: Buffer.from(cred.publicKey),
        counter: cred.counter,
        transports: cred.transports ?? [],
        deviceName: body.deviceName || null,
      },
    });

    // webauthn_reg_challenge Cookieを削除
    const clearCookie = buildSetCookieHeader("webauthn_reg_challenge", "", 0);

    return new NextResponse(
      JSON.stringify({
        verified: true,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": clearCookie,
        },
      },
    );
  },
);
