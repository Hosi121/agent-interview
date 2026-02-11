import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { withAuthValidation } from "@/lib/api-utils";

const MAX_TEXT_LENGTH = 4096;

const ttsSchema = z.object({
  text: z
    .string()
    .min(1, "テキストが空です")
    .max(MAX_TEXT_LENGTH, `テキストは${MAX_TEXT_LENGTH}文字以下にしてください`),
});

const openai = new OpenAI();

export const POST = withAuthValidation(ttsSchema, async (body) => {
  const response = await openai.audio.speech.create({
    model: "tts-1",
    voice: "nova",
    input: body.text,
  });

  return new NextResponse(response.body as ReadableStream, {
    headers: {
      "Content-Type": "audio/mpeg",
    },
  });
});
