import type { AccountType } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// セッションの型定義（next-authの拡張型に合わせる）
export interface AuthenticatedSession {
  user: {
    email?: string | null;
    name?: string | null;
    image?: string | null;
    accountId?: string;
    accountType?: AccountType;
    recruiterId?: string;
    userId?: string;
    companyName?: string;
  };
}

// エラーレスポンスの型定義
export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

// 認証済み採用担当者用ハンドラーの型
type RecruiterHandler<T = unknown> = (
  req: NextRequest,
  session: AuthenticatedSession & { user: { recruiterId: string } },
  context?: T,
) => Promise<NextResponse>;

// 認証済みユーザー用ハンドラーの型
type UserHandler<T = unknown> = (
  req: NextRequest,
  session: AuthenticatedSession & { user: { userId: string } },
  context?: T,
) => Promise<NextResponse>;

// 認証済み（どちらでも）用ハンドラーの型
type AuthenticatedHandler<T = unknown> = (
  req: NextRequest,
  session: AuthenticatedSession,
  context?: T,
) => Promise<NextResponse>;

/**
 * 採用担当者認証を必要とするAPIルートのラッパー
 */
export function withRecruiterAuth<T = unknown>(
  handler: RecruiterHandler<T>,
): (req: NextRequest, context?: T) => Promise<NextResponse> {
  return async (req: NextRequest, context?: T) => {
    try {
      const session = await getServerSession(authOptions);

      if (!session?.user) {
        return NextResponse.json(
          { error: "Unauthorized", code: "UNAUTHORIZED" },
          { status: 401 },
        );
      }

      if (!session.user.recruiterId) {
        return NextResponse.json(
          { error: "採用担当者権限が必要です", code: "RECRUITER_REQUIRED" },
          { status: 403 },
        );
      }

      return handler(
        req,
        session as unknown as AuthenticatedSession & {
          user: { recruiterId: string };
        },
        context,
      );
    } catch (error) {
      console.error("API error:", error);
      return NextResponse.json(
        { error: "Internal server error", code: "INTERNAL_ERROR" },
        { status: 500 },
      );
    }
  };
}

/**
 * ユーザー認証を必要とするAPIルートのラッパー
 */
export function withUserAuth<T = unknown>(
  handler: UserHandler<T>,
): (req: NextRequest, context?: T) => Promise<NextResponse> {
  return async (req: NextRequest, context?: T) => {
    try {
      const session = await getServerSession(authOptions);

      if (!session?.user) {
        return NextResponse.json(
          { error: "Unauthorized", code: "UNAUTHORIZED" },
          { status: 401 },
        );
      }

      if (!session.user.userId) {
        return NextResponse.json(
          { error: "ユーザー権限が必要です", code: "USER_REQUIRED" },
          { status: 403 },
        );
      }

      return handler(
        req,
        session as unknown as AuthenticatedSession & {
          user: { userId: string };
        },
        context,
      );
    } catch (error) {
      console.error("API error:", error);
      return NextResponse.json(
        { error: "Internal server error", code: "INTERNAL_ERROR" },
        { status: 500 },
      );
    }
  };
}

/**
 * 認証のみを必要とするAPIルートのラッパー（採用担当者/ユーザーどちらでも可）
 */
export function withAuth<T = unknown>(
  handler: AuthenticatedHandler<T>,
): (req: NextRequest, context?: T) => Promise<NextResponse> {
  return async (req: NextRequest, context?: T) => {
    try {
      const session = await getServerSession(authOptions);

      if (!session?.user) {
        return NextResponse.json(
          { error: "Unauthorized", code: "UNAUTHORIZED" },
          { status: 401 },
        );
      }

      return handler(req, session as unknown as AuthenticatedSession, context);
    } catch (error) {
      console.error("API error:", error);
      return NextResponse.json(
        { error: "Internal server error", code: "INTERNAL_ERROR" },
        { status: 500 },
      );
    }
  };
}

/**
 * 標準化されたエラーレスポンスを生成
 */
export function apiError(
  message: string,
  status: number,
  code?: string,
  details?: Record<string, unknown>,
): NextResponse<ApiErrorResponse> {
  return NextResponse.json({ error: message, code, details }, { status });
}

/**
 * 標準化された成功レスポンスを生成
 */
export function apiSuccess<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

/**
 * ポイント不足エラーレスポンス
 */
export function insufficientPointsError(
  required: number,
  available: number,
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      error: "ポイントが不足しています",
      code: "INSUFFICIENT_POINTS",
      details: { required, available },
    },
    { status: 402 },
  );
}

/**
 * サブスクリプションなしエラーレスポンス
 */
export function noSubscriptionError(): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      error: "サブスクリプションがありません",
      code: "NO_SUBSCRIPTION",
    },
    { status: 402 },
  );
}
