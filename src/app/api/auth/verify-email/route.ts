import { z } from "zod";
import { apiSuccess, withValidation } from "@/lib/api-utils";
import { verifyEmailToken } from "@/lib/verification";

const schema = z.object({
  token: z.string().min(1, "トークンが必要です"),
});

export const POST = withValidation(schema, async (body) => {
  await verifyEmailToken(body.token);
  return apiSuccess({ verified: true });
});
