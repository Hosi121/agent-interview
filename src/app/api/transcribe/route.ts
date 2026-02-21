import OpenAI from "openai";
import { apiSuccess, withAuth } from "@/lib/api-utils";
import { ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const TRANSCRIPTION_TIMEOUT_MS = 30_000; // 30秒

const openai = new OpenAI();

export const POST = withAuth(async (req) => {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    throw new ValidationError("音声ファイルが必要です");
  }

  if (!file.type.startsWith("audio/")) {
    throw new ValidationError("音声ファイルのみ対応しています");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new ValidationError("ファイルサイズは25MB以下にしてください");
  }

  const abortController = new AbortController();
  const timeout = setTimeout(
    () => abortController.abort(),
    TRANSCRIPTION_TIMEOUT_MS,
  );

  try {
    const transcription = await openai.audio.transcriptions.create(
      {
        model: "whisper-1",
        file,
        language: "ja",
      },
      { signal: abortController.signal },
    );

    return apiSuccess({ text: transcription.text });
  } catch (error) {
    if (abortController.signal.aborted) {
      logger.error("Transcription timeout", error as Error, {
        fileSize: file.size,
        fileType: file.type,
      });
      throw new ValidationError(
        "音声の文字起こしがタイムアウトしました。短い音声で再度お試しください。",
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
});
