import type { AccountType, CompanyMemberStatus, CompanyRole } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { ZodError, ZodSchema } from "zod";
import { authOptions } from "@/lib/auth";
import {
  AppError,
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";
import { logger } from "@/lib/logger";

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
    companyId?: string;
    companyName?: string;
    companyRole?: CompanyRole;
    recruiterStatus?: CompanyMemberStatus;
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
  session: AuthenticatedSession & {
    user: { recruiterId: string; companyId: string };
  },
  context?: T,
) => Promise<NextResponse>;

// Zodバリデーション付きの採用担当者用ハンドラーの型
type RecruiterValidatedHandler<TBody, TContext = unknown> = (
  body: TBody,
  req: NextRequest,
  session: AuthenticatedSession & {
    user: { recruiterId: string; companyId: string };
  },
  context?: TContext,
) => Promise<NextResponse>;

// 認証済みユーザー用ハンドラーの型
type UserHandler<T = unknown> = (
  req: NextRequest,
  session: AuthenticatedSession & { user: { userId: string } },
  context?: T,
) => Promise<NextResponse>;

// Zodバリデーション付きのユーザー用ハンドラーの型
type UserValidatedHandler<TBody, TContext = unknown> = (
  body: TBody,
  req: NextRequest,
  session: AuthenticatedSession & { user: { userId: string } },
  context?: TContext,
) => Promise<NextResponse>;

// 認証済み（どちらでも）用ハンドラーの型
type AuthenticatedHandler<T = unknown> = (
  req: NextRequest,
  session: AuthenticatedSession,
  context?: T,
) => Promise<NextResponse>;

// Zodバリデーション付きの認証ハンドラーの型
type AuthenticatedValidatedHandler<TBody, TContext = unknown> = (
  body: TBody,
  req: NextRequest,
  session: AuthenticatedSession,
  context?: TContext,
) => Promise<NextResponse>;

/**
 * ZodErrorをユーザーフレンドリーな形式に変換
 */
export function formatZodError(error: ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_root";
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(issue.message);
  }
  return formatted;
}

/**
 * エラーをNextResponseに変換
 * AppErrorの場合はそのままレスポンス化、それ以外は500エラー
 */
export function handleError(
  error: unknown,
  path?: string,
): NextResponse<ApiErrorResponse> {
  if (error instanceof AppError) {
    logger.error(error.message, error, {
      code: error.code,
      statusCode: error.statusCode,
      path,
      details: error.details,
    });
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        details: error.details,
      },
      { status: error.statusCode },
    );
  }

  // 予期しないエラー
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error("Unexpected error", err, { path });
  return NextResponse.json(
    {
      error: "システムエラーが発生しました",
      code: "INTERNAL_ERROR",
    },
    { status: 500 },
  );
}

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
        throw new UnauthorizedError();
      }

      if (!session.user.recruiterId) {
        throw new ForbiddenError("採用担当者権限が必要です");
      }

      if (session.user.recruiterStatus && session.user.recruiterStatus !== "ACTIVE") {
        throw new ForbiddenError("会社へのアクセス権が無効です");
      }

      if (!session.user.companyId) {
        throw new ForbiddenError("会社に所属していません");
      }

      return await handler(
        req,
        session as unknown as AuthenticatedSession & {
          user: { recruiterId: string; companyId: string };
        },
        context,
      );
    } catch (error) {
      return handleError(error, req?.nextUrl?.pathname);
    }
  };
}

/**
 * Zodバリデーション付きの採用担当者認証APIルートのラッパー
 */
export function withRecruiterValidation<TBody, TContext = unknown>(
  schema: ZodSchema<TBody>,
  handler: RecruiterValidatedHandler<TBody, TContext>,
): (req: NextRequest, context?: TContext) => Promise<NextResponse> {
  return withRecruiterAuth(async (req, session, context) => {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError("入力内容に問題があります", {
        fields: formatZodError(parsed.error),
      });
    }

    return handler(parsed.data, req, session, context);
  });
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
        throw new UnauthorizedError();
      }

      if (!session.user.userId) {
        throw new ForbiddenError("ユーザー権限が必要です");
      }

      return await handler(
        req,
        session as unknown as AuthenticatedSession & {
          user: { userId: string };
        },
        context,
      );
    } catch (error) {
      return handleError(error, req?.nextUrl?.pathname);
    }
  };
}

/**
 * Zodバリデーション付きのユーザー認証APIルートのラッパー
 */
export function withUserValidation<TBody, TContext = unknown>(
  schema: ZodSchema<TBody>,
  handler: UserValidatedHandler<TBody, TContext>,
): (req: NextRequest, context?: TContext) => Promise<NextResponse> {
  return withUserAuth(async (req, session, context) => {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError("入力内容に問題があります", {
        fields: formatZodError(parsed.error),
      });
    }

    return handler(parsed.data, req, session, context);
  });
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
        throw new UnauthorizedError();
      }

      if (session.user.recruiterStatus && session.user.recruiterStatus !== "ACTIVE") {
        throw new ForbiddenError("会社へのアクセス権が無効です");
      }

      return await handler(
        req,
        session as unknown as AuthenticatedSession,
        context,
      );
    } catch (error) {
      return handleError(error, req?.nextUrl?.pathname);
    }
  };
}

/**
 * Zodバリデーション付きの認証APIルートのラッパー
 */
export function withAuthValidation<TBody, TContext = unknown>(
  schema: ZodSchema<TBody>,
  handler: AuthenticatedValidatedHandler<TBody, TContext>,
): (req: NextRequest, context?: TContext) => Promise<NextResponse> {
  return withAuth(async (req, session, context) => {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError("入力内容に問題があります", {
        fields: formatZodError(parsed.error),
      });
    }

    return handler(parsed.data, req, session, context);
  });
}

/**
 * 認証不要のAPIルートのラッパー（エラーハンドリングのみ）
 */
export function withErrorHandling<T = unknown>(
  handler: (req: NextRequest, context?: T) => Promise<NextResponse>,
): (req: NextRequest, context?: T) => Promise<NextResponse> {
  return async (req: NextRequest, context?: T) => {
    try {
      return await handler(req, context);
    } catch (error) {
      return handleError(error, req?.nextUrl?.pathname);
    }
  };
}

/**
 * 認証不要でZodバリデーション付きのAPIルートのラッパー
 */
export function withValidation<TBody, TContext = unknown>(
  schema: ZodSchema<TBody>,
  handler: (
    body: TBody,
    req: NextRequest,
    context?: TContext,
  ) => Promise<NextResponse>,
): (req: NextRequest, context?: TContext) => Promise<NextResponse> {
  return withErrorHandling(async (req, context) => {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError("入力内容に問題があります", {
        fields: formatZodError(parsed.error),
      });
    }

    return handler(parsed.data, req, context);
  });
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
 * @deprecated Use InsufficientPointsError from errors.ts instead
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
 * @deprecated Use NoSubscriptionError from errors.ts instead
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
