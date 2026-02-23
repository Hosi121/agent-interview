"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useVoiceRecording } from "./useVoiceRecording";

export type VoiceConversationState =
  | "inactive"
  | "recording"
  | "transcribing"
  | "waiting";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface UseVoiceConversationOptions {
  onSendMessage: (message: string) => void;
  messages: Message[];
  isLoading: boolean;
}

interface UseVoiceConversationReturn {
  isActive: boolean;
  voiceState: VoiceConversationState;
  duration: number;
  error: string | null;
  toggleVoice: () => void;
}

async function transcribe(blob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append("file", blob, "recording.webm");

  const response = await fetch("/api/transcribe", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("文字起こしに失敗しました");
  }

  const data = await response.json();
  return data.text;
}

export function useVoiceConversation({
  onSendMessage,
  messages,
  isLoading,
}: UseVoiceConversationOptions): UseVoiceConversationReturn {
  const [isActive, setIsActive] = useState(false);
  const [voiceState, setVoiceState] =
    useState<VoiceConversationState>("inactive");
  const [error, setError] = useState<string | null>(null);

  const isActiveRef = useRef(false);
  const prevIsLoadingRef = useRef(isLoading);
  const recordingRef = useRef<{
    startRecording: () => Promise<void>;
    stopRecording: () => Promise<Blob | null>;
    acquireStream: () => Promise<void>;
    releaseStream: () => void;
  } | null>(null);

  const restartOrDeactivate = useCallback(() => {
    if (isActiveRef.current) {
      setVoiceState("recording");
      recordingRef.current?.startRecording().catch(() => {
        setError("録音の開始に失敗しました");
        isActiveRef.current = false;
        setIsActive(false);
        setVoiceState("inactive");
      });
    } else {
      setVoiceState("inactive");
    }
  }, []);

  const handleRecordingComplete = useCallback(
    async (blob: Blob | null) => {
      if (!blob || blob.size === 0) {
        restartOrDeactivate();
        return;
      }

      setVoiceState("transcribing");
      try {
        const text = await transcribe(blob);
        if (text.trim()) {
          onSendMessage(text.trim());
          setVoiceState("waiting");
        } else {
          restartOrDeactivate();
        }
      } catch {
        setError("文字起こしに失敗しました");
        restartOrDeactivate();
      }
    },
    [onSendMessage, restartOrDeactivate],
  );

  const handleSilenceDetected = useCallback(() => {
    if (isActiveRef.current) {
      recordingRef.current
        ?.stopRecording()
        .then(handleRecordingComplete)
        .catch(() => {
          restartOrDeactivate();
        });
    }
  }, [handleRecordingComplete, restartOrDeactivate]);

  const recording = useVoiceRecording({
    onSilenceDetected: handleSilenceDetected,
  });

  // recordingRef を常に最新のrecordingに同期
  recordingRef.current = recording;

  // ストリームエラー復帰: recording.stateがidle + errorのとき inactiveに戻す
  useEffect(() => {
    if (recording.error && recording.state === "idle" && isActiveRef.current) {
      isActiveRef.current = false;
      setIsActive(false);
      setVoiceState("inactive");
    }
  }, [recording.error, recording.state]);

  // AI応答完了時に次の状態へ遷移
  useEffect(() => {
    const wasLoading = prevIsLoadingRef.current;
    prevIsLoadingRef.current = isLoading;

    if (wasLoading && !isLoading && voiceState === "waiting") {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === "assistant" && lastMessage.content) {
        restartOrDeactivate();
      }
    }
  }, [isLoading, messages, voiceState, restartOrDeactivate]);

  // 連続会話: トグル
  const toggleVoice = useCallback(() => {
    if (isActive) {
      isActiveRef.current = false;
      setIsActive(false);
      const rec = recordingRef.current;
      if (!rec) {
        setVoiceState("inactive");
        return;
      }
      rec
        .stopRecording()
        .then(() => {
          rec.releaseStream();
          setVoiceState("inactive");
        })
        .catch(() => {
          rec.releaseStream();
          setVoiceState("inactive");
        });
    } else {
      setError(null);
      isActiveRef.current = true;
      setIsActive(true);
      setVoiceState("recording");
      const rec = recordingRef.current;
      if (!rec) {
        setIsActive(false);
        isActiveRef.current = false;
        setVoiceState("inactive");
        return;
      }
      rec
        .acquireStream()
        .then(() => {
          return rec.startRecording();
        })
        .catch(() => {
          setError("録音の開始に失敗しました");
          rec.releaseStream();
          setIsActive(false);
          isActiveRef.current = false;
          setVoiceState("inactive");
        });
    }
  }, [isActive]);

  return {
    isActive,
    voiceState,
    duration: recording.duration,
    error: error || recording.error,
    toggleVoice,
  };
}
