import { z } from "zod";
import { apiSuccess, withRateLimitValidation } from "@/lib/api-utils";
import { RATE_LIMIT_PRESETS } from "@/lib/rate-limiter";
import { verifyEmailToken } from "@/lib/verification";

const schema = z.object({
  token: z.string().min(1, "トークンが必要です"),
});

export const POST = withRateLimitValidation(
  RATE_LIMIT_PRESETS.VERIFY_EMAIL,
  schema,
  async (body) => {
    await verifyEmailToken(body.token);
    return apiSuccess({ verified: true });
  },
);
