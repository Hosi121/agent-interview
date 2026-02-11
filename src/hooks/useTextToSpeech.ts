"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type TTSState = "idle" | "speaking";

interface UseTextToSpeechOptions {
  onFinished?: () => void;
}

interface UseTextToSpeechReturn {
  state: TTSState;
  speak: (text: string) => Promise<void>;
  stop: () => void;
}

export function useTextToSpeech(
  options: UseTextToSpeechOptions = {},
): UseTextToSpeechReturn {
  const { onFinished } = options;

  const [state, setState] = useState<TTSState>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setState("idle");
  }, []);

  // アンマウント時にリソースを解放
  useEffect(() => {
    return () => stop();
  }, [stop]);

  const speak = useCallback(
    async (text: string) => {
      stop();

      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error("音声の生成に失敗しました");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      setState("speaking");

      audio.onended = () => {
        stop();
        onFinished?.();
      };

      audio.onerror = () => {
        stop();
      };

      await audio.play();
    },
    [stop, onFinished],
  );

  return {
    state,
    speak,
    stop,
  };
}
