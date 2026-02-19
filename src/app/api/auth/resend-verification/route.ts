import { z } from "zod";
import { apiSuccess, withValidation } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { createAndSendVerificationToken } from "@/lib/verification";

const schema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
});

export const POST = withValidation(schema, async (body) => {
  const account = await prisma.account.findUnique({
    where: { email: body.email },
  });

  // アカウント有無に関わらず同じレスポンス（情報漏洩防止）
  if (account && !account.emailVerified) {
    await createAndSendVerificationToken(account.id, account.email);
  }

  return apiSuccess({ sent: true });
});
