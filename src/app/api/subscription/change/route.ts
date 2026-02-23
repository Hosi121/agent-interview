import { z } from "zod";
import { withRecruiterValidation } from "@/lib/api-utils";
import { ForbiddenError } from "@/lib/errors";

const changePlanSchema = z.object({
  planType: z.enum(["LIGHT", "STANDARD", "ENTERPRISE"], {
    message: "無効なプランタイプです",
  }),
});

export const POST = withRecruiterValidation(
  changePlanSchema,
  async (body, req, session) => {
    if (!session.user.companyId) {
      throw new ForbiddenError("会社に所属していません");
    }
    if (
      !session.user.companyRole ||
      (session.user.companyRole !== "OWNER" &&
        session.user.companyRole !== "ADMIN")
    ) {
      throw new ForbiddenError("プラン変更の権限がありません");
    }

    // TODO: Stripe Checkout Session を作成し、決済完了後にwebhookでサブスクリプションを作成・変更する
    // 現在はStripe連携が未実装のため、直接のプラン変更を無効化
    throw new ForbiddenError(
      "プラン変更は現在準備中です。Stripe決済連携の実装後に利用可能になります。",
    );
  },
);
