import { NextResponse } from "next/server";
import { withRecruiterAuth } from "@/lib/api-utils";
import { ForbiddenError } from "@/lib/errors";
import { getPointHistory } from "@/lib/points";

// ポイント履歴取得
export const GET = withRecruiterAuth(async (req, session) => {
  if (!session.user.companyId) {
    throw new ForbiddenError("会社に所属していません");
  }

  const searchParams = req.nextUrl.searchParams;
  const rawLimit = Number.parseInt(searchParams.get("limit") || "50", 10);
  const limit = Math.min(
    Math.max(Number.isNaN(rawLimit) ? 50 : rawLimit, 1),
    200,
  );
  const rawOffset = Number.parseInt(searchParams.get("offset") || "0", 10);
  const offset = Math.max(Number.isNaN(rawOffset) ? 0 : rawOffset, 0);

  const history = await getPointHistory(session.user.companyId, limit, offset);

  return NextResponse.json({ history });
});
