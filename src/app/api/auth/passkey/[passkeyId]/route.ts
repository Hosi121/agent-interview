import { apiSuccess, withAuth } from "@/lib/api-utils";
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { uuidSchema } from "@/lib/validations";

type RouteContext = { params: Promise<{ passkeyId: string }> };

export const DELETE = withAuth(async (_req, session, context) => {
  const { passkeyId } = await (context as RouteContext).params;

  if (!uuidSchema.safeParse(passkeyId).success) {
    throw new ValidationError("無効なパスキーIDです");
  }

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

  // TOCTOU防止: accountId条件付きdeleteで所有権を原子的に検証
  const result = await prisma.passkey.deleteMany({
    where: { id: passkeyId, accountId },
  });

  if (result.count === 0) {
    throw new NotFoundError("パスキーの削除に失敗しました");
  }

  return apiSuccess({ deleted: true });
});
