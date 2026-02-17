/**
 * アプリケーションエラー基底クラス
 * HTTPステータスとエラーコードを持ち、予期されるエラーかどうかを示す
 */
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;
  readonly details?: Record<string, unknown>;
  readonly isOperational = true;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * バリデーションエラー (400)
 * 入力値が不正な場合に使用
 */
export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly code = "VALIDATION_ERROR";

  constructor(
    message = "入力内容に問題があります",
    details?: Record<string, unknown>,
  ) {
    super(message, details);
  }
}

/**
 * 認証エラー (401)
 * ログインが必要な場合に使用
 */
export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly code = "UNAUTHORIZED";

  constructor(message = "認証が必要です", details?: Record<string, unknown>) {
    super(message, details);
  }
}

/**
 * 権限エラー (403)
 * ログイン済みだが権限がない場合に使用
 */
export class ForbiddenError extends AppError {
  readonly statusCode = 403;
  readonly code = "FORBIDDEN";

  constructor(
    message = "アクセス権限がありません",
    details?: Record<string, unknown>,
  ) {
    super(message, details);
  }
}

/**
 * リソースが見つからないエラー (404)
 */
export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = "NOT_FOUND";

  constructor(
    message = "リソースが見つかりません",
    details?: Record<string, unknown>,
  ) {
    super(message, details);
  }
}

/**
 * コンフリクトエラー (409)
 * リソースの状態が操作と矛盾する場合に使用
 */
export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code = "CONFLICT";

  constructor(
    message = "リソースの状態が矛盾しています",
    details?: Record<string, unknown>,
  ) {
    super(message, details);
  }
}

/**
 * ポイント不足エラー (402)
 * ポイントが足りない場合に使用
 */
export class InsufficientPointsError extends AppError {
  readonly statusCode = 402;
  readonly code = "INSUFFICIENT_POINTS";

  constructor(
    public readonly required: number,
    public readonly available: number,
  ) {
    super(
      `ポイントが不足しています。必要: ${required}pt, 残高: ${available}pt`,
      { required, available },
    );
  }
}

/**
 * サブスクリプションなしエラー (402)
 * サブスクリプション契約がない場合に使用
 */
export class NoSubscriptionError extends AppError {
  readonly statusCode = 402;
  readonly code = "NO_SUBSCRIPTION";

  constructor(
    message = "サブスクリプションがありません。プランを選択してください。",
  ) {
    super(message);
  }
}

/**
 * レート制限エラー (429)
 * リクエスト頻度が高すぎる場合に使用
 */
export class RateLimitError extends AppError {
  readonly statusCode = 429;
  readonly code = "RATE_LIMITED";
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(
      `リクエストが多すぎます。${retryAfterSeconds}秒後に再試行してください。`,
      {
        retryAfterSeconds,
      },
    );
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * 内部エラー (500)
 * 予期しないシステムエラーの場合に使用
 */
export class InternalError extends AppError {
  readonly statusCode = 500;
  readonly code = "INTERNAL_ERROR";

  constructor(
    message = "システムエラーが発生しました",
    details?: Record<string, unknown>,
  ) {
    super(message, details);
  }
}
