"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTextToSpeech } from "./useTextToSpeech";
import { useVoiceRecording } from "./useVoiceRecording";

export type VoiceMode = "push-to-talk" | "continuous";

export type VoiceConversationState =
  | "inactive"
  | "recording"
  | "transcribing"
  | "waiting"
  | "speaking";

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
  mode: VoiceMode;
  setMode: (mode: VoiceMode) => void;
  isActive: boolean;
  voiceState: VoiceConversationState;
  duration: number;
  error: string | null;
  onPressStart: () => void;
  onPressEnd: () => void;
  toggleContinuous: () => void;
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
  const [mode, setMode] = useState<VoiceMode>("push-to-talk");
  const [isActive, setIsActive] = useState(false);
  const [voiceState, setVoiceState] =
    useState<VoiceConversationState>("inactive");
  const [error, setError] = useState<string | null>(null);

  const isActiveRef = useRef(false);
  const prevIsLoadingRef = useRef(isLoading);
  const prevMessagesLenRef = useRef(messages.length);
  const recordingRef = useRef<{
    startRecording: () => Promise<void>;
    stopRecording: () => Promise<Blob | null>;
  } | null>(null);

  const handleRecordingComplete = useCallback(
    async (blob: Blob | null) => {
      if (!blob || blob.size === 0) {
        setVoiceState(isActiveRef.current ? "recording" : "inactive");
        return;
      }

      setVoiceState("transcribing");
      try {
        const text = await transcribe(blob);
        if (text.trim()) {
          onSendMessage(text.trim());
          setVoiceState("waiting");
        } else {
          setVoiceState(isActiveRef.current ? "recording" : "inactive");
        }
      } catch {
        setError("文字起こしに失敗しました");
        setVoiceState(isActiveRef.current ? "recording" : "inactive");
      }
    },
    [onSendMessage],
  );

  const handleSilenceDetected = useCallback(() => {
    if (isActiveRef.current && mode === "continuous") {
      recordingRef.current?.stopRecording().then(handleRecordingComplete);
    }
  }, [mode, handleRecordingComplete]);

  const startRecordingWithErrorHandling = useCallback(() => {
    recordingRef.current?.startRecording().catch(() => {
      setError("録音の開始に失敗しました");
      setVoiceState(isActiveRef.current ? "recording" : "inactive");
    });
  }, []);

  const tts = useTextToSpeech({
    onFinished: () => {
      setVoiceState(isActiveRef.current ? "recording" : "inactive");
      if (isActiveRef.current && mode === "continuous") {
        startRecordingWithErrorHandling();
      }
    },
  });

  const recording = useVoiceRecording({
    onSilenceDetected:
      mode === "continuous" ? handleSilenceDetected : undefined,
  });

  // recordingRef を常に最新のrecordingに同期
  recordingRef.current = recording;

  // AI応答完了時にTTS再生を開始
  useEffect(() => {
    const wasLoading = prevIsLoadingRef.current;
    const prevLen = prevMessagesLenRef.current;
    prevIsLoadingRef.current = isLoading;
    prevMessagesLenRef.current = messages.length;

    if (
      wasLoading &&
      !isLoading &&
      voiceState === "waiting" &&
      messages.length > prevLen
    ) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === "assistant" && lastMessage.content) {
        setVoiceState("speaking");
        tts.speak(lastMessage.content).catch(() => {
          setVoiceState(isActiveRef.current ? "recording" : "inactive");
          if (isActiveRef.current && mode === "continuous") {
            startRecordingWithErrorHandling();
          }
        });
      }
    }
  }, [
    isLoading,
    messages,
    voiceState,
    tts.speak,
    mode,
    startRecordingWithErrorHandling,
  ]);

  // Push-to-talk: ボタン押下→録音開始
  const onPressStart = useCallback(() => {
    if (mode !== "push-to-talk") return;
    setError(null);
    setIsActive(true);
    isActiveRef.current = true;
    setVoiceState("recording");
    recording.startRecording().catch(() => {
      setError("録音の開始に失敗しました");
      setIsActive(false);
      isActiveRef.current = false;
      setVoiceState("inactive");
    });
  }, [mode, recording.startRecording]);

  // Push-to-talk: ボタン離す→録音停止→文字起こし→送信
  const onPressEnd = useCallback(() => {
    if (mode !== "push-to-talk") return;
    isActiveRef.current = false;
    setIsActive(false);
    recording.stopRecording().then(handleRecordingComplete);
  }, [mode, recording.stopRecording, handleRecordingComplete]);

  // 連続会話: トグル
  const toggleContinuous = useCallback(() => {
    if (mode !== "continuous") return;

    if (isActive) {
      isActiveRef.current = false;
      setIsActive(false);
      tts.stop();
      recording.stopRecording().then(() => {
        setVoiceState("inactive");
      });
    } else {
      setError(null);
      isActiveRef.current = true;
      setIsActive(true);
      setVoiceState("recording");
      recording.startRecording().catch(() => {
        setError("録音の開始に失敗しました");
        setIsActive(false);
        isActiveRef.current = false;
        setVoiceState("inactive");
      });
    }
  }, [
    mode,
    isActive,
    tts.stop,
    recording.startRecording,
    recording.stopRecording,
  ]);

  return {
    mode,
    setMode,
    isActive,
    voiceState,
    duration: recording.duration,
    error: error || recording.error,
    onPressStart,
    onPressEnd,
    toggleContinuous,
  };
}
