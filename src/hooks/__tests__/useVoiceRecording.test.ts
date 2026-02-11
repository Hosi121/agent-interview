import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useVoiceRecording } from "../useVoiceRecording";

// MediaRecorder モック
const mockStart = vi.fn();
const mockStop = vi.fn();
let mockOndataavailable: ((e: { data: Blob }) => void) | null = null;
let mockOnstop: (() => void) | null = null;

class MockMediaRecorder {
  static isTypeSupported = vi.fn().mockReturnValue(true);

  state = "recording";
  start = mockStart;
  stop = mockStop;
  private _ondataavailable: ((e: { data: Blob }) => void) | null = null;
  private _onstop: (() => void) | null = null;

  get ondataavailable() {
    return this._ondataavailable;
  }
  set ondataavailable(fn: ((e: { data: Blob }) => void) | null) {
    this._ondataavailable = fn;
    mockOndataavailable = fn;
  }

  get onstop() {
    return this._onstop;
  }
  set onstop(fn: (() => void) | null) {
    this._onstop = fn;
    mockOnstop = fn;
  }
}

// getUserMedia モック
const mockGetUserMedia = vi.fn();
const mockTrackStop = vi.fn();

// AudioContext モック
const mockGetByteTimeDomainData = vi.fn();
const mockConnect = vi.fn();
const mockClose = vi.fn();

const mockAnalyser = {
  fftSize: 2048,
  getByteTimeDomainData: mockGetByteTimeDomainData,
};

class MockAudioContext {
  createMediaStreamSource = vi.fn().mockReturnValue({
    connect: mockConnect,
  });
  createAnalyser = vi.fn().mockReturnValue(mockAnalyser);
  close = mockClose;
}

// グローバルモック設定
vi.stubGlobal("MediaRecorder", MockMediaRecorder);
vi.stubGlobal("AudioContext", MockAudioContext);
vi.stubGlobal("navigator", {
  mediaDevices: {
    getUserMedia: mockGetUserMedia,
  },
});

describe("useVoiceRecording", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockOndataavailable = null;
    mockOnstop = null;

    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: mockTrackStop }],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("初期状態はidleである", () => {
    const { result } = renderHook(() => useVoiceRecording());
    expect(result.current.state).toBe("idle");
    expect(result.current.duration).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it("startRecordingで録音が開始される", async () => {
    const { result } = renderHook(() => useVoiceRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(mockGetUserMedia).toHaveBeenCalledWith({
      audio: { channelCount: 1 },
    });
    expect(mockStart).toHaveBeenCalledWith(100);
    expect(result.current.state).toBe("recording");
  });

  it("録音経過時間がカウントアップされる", async () => {
    const { result } = renderHook(() => useVoiceRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.duration).toBe(0);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.duration).toBe(2);
  });

  it("stopRecordingで録音が停止しBlobが返される", async () => {
    const { result } = renderHook(() => useVoiceRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    // データを模擬
    act(() => {
      mockOndataavailable?.({
        data: new Blob(["audio-data"], { type: "audio/webm" }),
      });
    });

    let blob: Blob | null = null;
    await act(async () => {
      const promise = result.current.stopRecording();
      // MediaRecorderのonstopをシミュレート
      mockOnstop?.();
      blob = await promise;
    });

    expect(blob).not.toBeNull();
    expect(blob).toBeInstanceOf(Blob);
  });

  it("マイク権限エラー時にエラーメッセージが設定される", async () => {
    const notAllowedError = new DOMException(
      "Permission denied",
      "NotAllowedError",
    );
    mockGetUserMedia.mockRejectedValueOnce(notAllowedError);

    const { result } = renderHook(() => useVoiceRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.state).toBe("idle");
    expect(result.current.error).toBe("マイクへのアクセスが許可されていません");
  });

  it("一般的なエラー時にエラーメッセージが設定される", async () => {
    mockGetUserMedia.mockRejectedValueOnce(new Error("Something went wrong"));

    const { result } = renderHook(() => useVoiceRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.state).toBe("idle");
    expect(result.current.error).toBe("録音の開始に失敗しました");
  });

  it("無音検知コールバックが設定されるとAudioContextが作成される", async () => {
    const onSilenceDetected = vi.fn();

    const { result } = renderHook(() =>
      useVoiceRecording({ onSilenceDetected }),
    );

    await act(async () => {
      await result.current.startRecording();
    });

    // MockAudioContextのインスタンスメソッドが呼ばれたことを確認
    expect(mockConnect).toHaveBeenCalled();
  });

  it("録音がinactive状態のときstopRecordingはnullを返す", async () => {
    const { result } = renderHook(() => useVoiceRecording());

    const blob = await act(async () => {
      return result.current.stopRecording();
    });

    expect(blob).toBeNull();
  });
});
