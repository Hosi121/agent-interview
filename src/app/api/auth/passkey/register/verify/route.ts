import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { apiSuccess, withAuthValidation } from "@/lib/api-utils";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { passkeyRegisterVerifySchema } from "@/lib/validations";
import { expectedOrigins, rpID } from "@/lib/webauthn";

export const POST = withAuthValidation(
  passkeyRegisterVerifySchema,
  async (body, _req, session) => {
    const accountId = session.user.accountId!;
    const credential = body.credential as unknown as RegistrationResponseJSON;

    // DB からチャレンジをアトミックに取得・削除（1回限り使用）
    // findFirst + delete の代わりに、最新のチャレンジを削除して取得
    const stored = await prisma.webAuthnChallenge.findFirst({
      where: {
        accountId,
        type: "registration",
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!stored) {
      throw new NotFoundError(
        "チャレンジが見つかりません。再度お試しください。",
      );
    }

    // アトミックに削除（条件付きdelete — 他のリクエストが先に消した場合は失敗する）
    const deleted = await prisma.webAuthnChallenge
      .delete({ where: { id: stored.id } })
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
        credentialId: Buffer.from(cred.id),
        credentialPublicKey: Buffer.from(cred.publicKey),
        counter: cred.counter,
        transports: cred.transports ?? [],
        deviceName: body.deviceName || null,
      },
    });

    return apiSuccess({
      verified: true,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
    });
  },
);
