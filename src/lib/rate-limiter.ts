import type { NextRequest } from "next/server";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { RateLimitError } from "@/lib/errors";

export type RateLimitPreset = {
  points: number;
  duration: number;
};

export const RATE_LIMIT_PRESETS = {
  /** 認証系公開エンドポイント: 10req/60s per IP */
  PUBLIC_AUTH: { points: 10, duration: 60 } satisfies RateLimitPreset,
  /** アカウント登録: 5req/300s per IP（ブルートフォース防止） */
  REGISTER: { points: 5, duration: 300 } satisfies RateLimitPreset,
  /** メール認証・再送: 3req/300s per IP（スパム防止） */
  VERIFY_EMAIL: { points: 3, duration: 300 } satisfies RateLimitPreset,
} as const;

const limiters = new Map<string, RateLimiterMemory>();

function getLimiter(preset: RateLimitPreset): RateLimiterMemory {
  const key = `${preset.points}:${preset.duration}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    limiter = new RateLimiterMemory({
      points: preset.points,
      duration: preset.duration,
    });
    limiters.set(key, limiter);
  }
  return limiter;
}

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function checkRateLimit(
  req: NextRequest,
  preset: RateLimitPreset,
  key?: string,
): Promise<void> {
  const limiter = getLimiter(preset);
  const consumeKey = key || getClientIp(req);

  try {
    await limiter.consume(consumeKey);
  } catch (rateLimiterRes) {
    const res = rateLimiterRes as { msBeforeNext?: number };
    const retryAfter = Math.ceil((res.msBeforeNext ?? 1000) / 1000);
    throw new RateLimitError(retryAfter);
  }
}
