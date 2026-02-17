import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { CHALLENGE_TTL_MS, rpID } from "@/lib/webauthn";

export const POST = withErrorHandling(async () => {
  // 期限切れチャレンジを削除
  await prisma.webAuthnChallenge.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

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
  const isProduction = process.env.NODE_ENV === "production";
  const cookie = [
    `webauthn_challenge=${record.id}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=300",
    isProduction ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");

  return new NextResponse(JSON.stringify(options), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookie,
    },
  });
});
