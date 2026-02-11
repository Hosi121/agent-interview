import OpenAI from "openai";
import { apiSuccess, withAuth } from "@/lib/api-utils";
import { ValidationError } from "@/lib/errors";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

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

  const transcription = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file,
    language: "ja",
  });

  return apiSuccess({ text: transcription.text });
});
