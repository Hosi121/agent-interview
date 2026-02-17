import { apiSuccess, withAuth } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(async (_req, session) => {
  const accountId = session.user.accountId!;

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
