"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecordingState = "idle" | "recording" | "processing";

interface UseVoiceRecordingOptions {
  onSilenceDetected?: () => void;
  silenceThreshold?: number;
  silenceDuration?: number;
}

interface UseVoiceRecordingReturn {
  state: RecordingState;
  duration: number;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
}

const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function getSupportedMimeType(): string | undefined {
  return PREFERRED_MIME_TYPES.find((type) =>
    MediaRecorder.isTypeSupported(type),
  );
}

export function useVoiceRecording(
  options: UseVoiceRecordingOptions = {},
): UseVoiceRecordingReturn {
  const {
    onSilenceDetected,
    silenceThreshold = 10,
    silenceDuration = 1500,
  } = options;

  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceRafRef = useRef<number | null>(null);
  const resolveStopRef = useRef<((blob: Blob | null) => void) | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (silenceRafRef.current) {
      cancelAnimationFrame(silenceRafRef.current);
      silenceRafRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  const monitorSilence = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser || !onSilenceDetected) return;

    const dataArray = new Uint8Array(analyser.fftSize);
    let isSilent = false;

    const check = () => {
      if (!analyserRef.current) return;

      analyser.getByteTimeDomainData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const val = dataArray[i] - 128;
        sum += val * val;
      }
      const rms = Math.sqrt(sum / dataArray.length);

      if (rms < silenceThreshold) {
        if (!isSilent) {
          isSilent = true;
          silenceTimerRef.current = setTimeout(() => {
            onSilenceDetected();
          }, silenceDuration);
        }
      } else {
        isSilent = false;
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      }

      silenceRafRef.current = requestAnimationFrame(check);
    };

    check();
  }, [onSilenceDetected, silenceThreshold, silenceDuration]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1 },
      });
      streamRef.current = stream;

      if (onSilenceDetected) {
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        analyserRef.current = analyser;
      }

      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mimeType ?? "audio/webm",
        });
        cleanup();
        if (resolveStopRef.current) {
          resolveStopRef.current(blob);
          resolveStopRef.current = null;
        }
      };

      mediaRecorder.start(100);
      setState("recording");
      setDuration(0);

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      if (onSilenceDetected) {
        monitorSilence();
      }
    } catch (err) {
      cleanup();
      setState("idle");
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError("マイクへのアクセスが許可されていません");
      } else {
        setError("録音の開始に失敗しました");
      }
    }
  }, [cleanup, monitorSilence, onSilenceDetected]);

  // アンマウント時にリソースを解放
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    if (
      !mediaRecorderRef.current ||
      mediaRecorderRef.current.state === "inactive"
    ) {
      return null;
    }

    setState("processing");

    return new Promise<Blob | null>((resolve) => {
      resolveStopRef.current = resolve;
      mediaRecorderRef.current?.stop();
    });
  }, []);

  return {
    state,
    duration,
    error,
    startRecording,
    stopRecording,
  };
}
