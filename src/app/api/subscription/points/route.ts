import { z } from "zod";
import { withRecruiterValidation } from "@/lib/api-utils";
import { ForbiddenError } from "@/lib/errors";

const purchasePointsSchema = z.object({
  amount: z
    .number()
    .int("ポイント数は整数で指定してください")
    .min(10, "最低10ポイントから購入できます"),
});

export const POST = withRecruiterValidation(
  purchasePointsSchema,
  async (_body, _req, session) => {
    if (!session.user.companyId) {
      throw new ForbiddenError("会社に所属していません");
    }
    if (
      !session.user.companyRole ||
      (session.user.companyRole !== "OWNER" &&
        session.user.companyRole !== "ADMIN")
    ) {
      throw new ForbiddenError("ポイント購入の権限がありません");
    }

    // TODO: Stripe Checkout Session を作成し、決済完了後にwebhookでポイントを付与する
    // 現在はStripe連携が未実装のため、直接のポイント追加を無効化
    throw new ForbiddenError(
      "ポイント購入は現在準備中です。Stripe決済連携の実装後に利用可能になります。",
    );
  },
);
