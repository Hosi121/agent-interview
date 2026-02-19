import { FragmentType, type Prisma } from "@prisma/client";

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const qualityToConfidence: Record<string, number> = {
  low: 0.4,
  medium: 0.7,
  high: 1.0,
};

const FRAGMENT_TYPE_VALUES = new Set<string>(Object.values(FragmentType));

/** 文字列を FragmentType に変換する。無効な値は "FACT" にフォールバック */
export function parseFragmentType(value: string | undefined): FragmentType {
  if (value && FRAGMENT_TYPE_VALUES.has(value)) {
    return value as FragmentType;
  }
  return FragmentType.FACT;
}

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

  // 関連する Tagging を削除
  await tx.tagging.deleteMany({
    where: { taggableType: "FRAGMENT", taggableId: fragmentId },
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
