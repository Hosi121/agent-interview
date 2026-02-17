import { apiSuccess, withAuth } from "@/lib/api-utils";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ passkeyId: string }> };

export const DELETE = withAuth(async (_req, session, context) => {
  const { passkeyId } = await (context as RouteContext).params;
  const accountId = session.user.accountId;
  if (!accountId) {
    throw new UnauthorizedError("アカウント情報が取得できません");
  }

  const passkey = await prisma.passkey.findUnique({
    where: { id: passkeyId },
  });

  if (!passkey) {
    throw new NotFoundError("パスキーが見つかりません");
  }

  if (passkey.accountId !== accountId) {
    throw new ForbiddenError("このパスキーを削除する権限がありません");
  }

  await prisma.passkey.delete({ where: { id: passkeyId } });

  return apiSuccess({ deleted: true });
});
