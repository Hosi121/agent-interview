import { apiSuccess, withAuth } from "@/lib/api-utils";
import { UnauthorizedError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(async (_req, session) => {
  const accountId = session.user.accountId;
  if (!accountId) {
    throw new UnauthorizedError("アカウント情報が取得できません");
  }

  const passkeys = await prisma.passkey.findMany({
    where: { accountId },
    select: {
      id: true,
      deviceName: true,
      createdAt: true,
      lastUsedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return apiSuccess({ passkeys });
});
