import type { Prisma } from "@prisma/client";

/**
 * フラグメントと関連レコードをトランザクション内で削除する
 */
export async function deleteFragmentWithRelations(
  tx: Prisma.TransactionClient,
  fragmentId: string,
) {
  // 関連する MessageReference を先に削除
  await tx.messageReference.deleteMany({
    where: { refType: "FRAGMENT", refId: fragmentId },
  });

  // 子フラグメントの parentId を null に更新
  await tx.fragment.updateMany({
    where: { parentId: fragmentId },
    data: { parentId: null },
  });

  // フラグメント本体を削除
  await tx.fragment.delete({
    where: { id: fragmentId },
  });
}
