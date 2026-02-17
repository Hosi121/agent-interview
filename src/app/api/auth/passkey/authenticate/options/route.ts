import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import { withRateLimit } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { RATE_LIMIT_PRESETS } from "@/lib/rate-limiter";
import { buildSetCookieHeader, CHALLENGE_TTL_MS, rpID } from "@/lib/webauthn";

export const POST = withRateLimit(RATE_LIMIT_PRESETS.PUBLIC_AUTH, async () => {
  // 期限切れチャレンジを削除（レスポンスをブロックしない）
  prisma.webAuthnChallenge
    .deleteMany({
      where: { expiresAt: { lt: new Date() } },
    })
    .catch(() => {});

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
  });

  // チャレンジをDBに保存（未認証なのでaccountId無し）
  const record = await prisma.webAuthnChallenge.create({
    data: {
      challenge: options.challenge,
      type: "authentication",
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
  });

  // チャレンジIDをhttpOnly Cookieでクライアントにバインド
  const cookie = buildSetCookieHeader("webauthn_challenge", record.id, 300);

  return new NextResponse(JSON.stringify(options), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookie,
    },
  });
});
