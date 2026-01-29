/**
 * slog風の構造化ログ
 * JSON Lines形式で出力し、本番環境でログ監視ツール（DataDog, CloudWatch等）で検索・アラート可能にする
 */

type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

function formatLogEntry(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
  error?: Error,
): LogEntry {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return entry;
}

function output(level: LogLevel, entry: LogEntry): void {
  const json = JSON.stringify(entry);

  if (level === "error") {
    console.error(json);
  } else if (level === "warn") {
    console.warn(json);
  } else {
    console.log(json);
  }
}

export const logger = {
  /**
   * 情報ログを出力
   * @param message ログメッセージ
   * @param context 追加のコンテキスト情報
   */
  info(message: string, context?: Record<string, unknown>): void {
    const entry = formatLogEntry("info", message, context);
    output("info", entry);
  },

  /**
   * 警告ログを出力
   * @param message ログメッセージ
   * @param context 追加のコンテキスト情報
   */
  warn(message: string, context?: Record<string, unknown>): void {
    const entry = formatLogEntry("warn", message, context);
    output("warn", entry);
  },

  /**
   * エラーログを出力
   * @param message ログメッセージ
   * @param error エラーオブジェクト
   * @param context 追加のコンテキスト情報
   */
  error(
    message: string,
    error?: Error,
    context?: Record<string, unknown>,
  ): void {
    const entry = formatLogEntry("error", message, context, error);
    output("error", entry);
  },
};
