"use client";

import { Mic, MicOff, Square, Volume2 } from "lucide-react";
import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FollowUpSuggestions } from "@/components/interview/FollowUpSuggestions";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useVoiceConversation } from "@/hooks/useVoiceConversation";
import { MessageBubble } from "./MessageBubble";

interface FragmentReference {
  id: string;
  type: string;
  content: string;
  skills: string[];
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  references?: FragmentReference[];
}

interface ChatWindowProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  userName?: string;
  assistantName?: string;
  assistantAvatarPath?: string | null;
  placeholder?: string;
  draftMessage?: string;
  onDraftChange?: (value: string) => void;
  followUpSuggestions?: string[];
  onFollowUpSelect?: (suggestion: string) => void;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ChatWindow({
  messages,
  onSendMessage,
  isLoading = false,
  userName,
  assistantName,
  assistantAvatarPath,
  placeholder = "メッセージを入力...",
  draftMessage,
  onDraftChange,
  followUpSuggestions = [],
  onFollowUpSelect,
  inputRef,
}: ChatWindowProps) {
  const [internalInput, setInternalInput] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputValue = draftMessage ?? internalInput;
  const setInputValue = onDraftChange ?? setInternalInput;

  const voice = useVoiceConversation({
    onSendMessage,
    messages,
    isLoading: isLoading ?? false,
  });

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)");
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputValue.trim() || isLoading) return;
      onSendMessage(inputValue.trim());
      setInputValue("");
    },
    [inputValue, isLoading, onSendMessage, setInputValue],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (isMobile) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      }
    },
    [isMobile, handleSubmit],
  );

  const isVoiceBusy =
    voice.voiceState !== "inactive" && voice.voiceState !== "recording";

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <p>メッセージはまだありません</p>
              <p className="text-sm mt-2">AIに話しかけてみましょう</p>
            </div>
          )}
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              messageId={message.id}
              content={message.content}
              role={message.role}
              senderName={userName}
              assistantName={assistantName}
              assistantAvatarPath={assistantAvatarPath}
              references={message.references}
            />
          ))}
          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex gap-2.5">
              <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs text-primary">
                  {assistantName?.[0] || "AI"}
                </span>
              </div>
              <div className="bg-secondary rounded-lg px-3.5 py-2">
                <div className="flex gap-1">
                  <span className="size-1.5 bg-muted-foreground/60 rounded-full animate-bounce" />
                  <span className="size-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:0.1s]" />
                  <span className="size-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:0.2s]" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      {followUpSuggestions.length > 0 && onFollowUpSelect && (
        <FollowUpSuggestions
          suggestions={followUpSuggestions}
          onSelect={onFollowUpSelect}
        />
      )}
      {/* 音声状態インジケーター */}
      {voice.voiceState !== "inactive" && (
        <div className="flex items-center gap-2 px-4 py-2 text-sm">
          {voice.voiceState === "recording" && (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
              </span>
              <span className="text-red-600">
                録音中 {formatDuration(voice.duration)}
              </span>
            </>
          )}
          {voice.voiceState === "transcribing" && (
            <span className="text-muted-foreground">文字起こし中...</span>
          )}
          {voice.voiceState === "waiting" && (
            <span className="text-muted-foreground">
              AI応答を待っています...
            </span>
          )}
          {voice.voiceState === "speaking" && (
            <span className="flex items-center gap-1.5 text-blue-600">
              <Volume2 className="size-4 animate-pulse" />
              音声を再生中...
            </span>
          )}
        </div>
      )}
      {voice.error && (
        <div className="px-4 py-1">
          <p className="text-xs text-destructive">{voice.error}</p>
        </div>
      )}
      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex gap-2">
          <Textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="min-h-[60px] resize-none"
            disabled={isLoading || isVoiceBusy}
          />
          <div className="flex flex-col gap-1">
            {voice.mode === "push-to-talk" ? (
              <Button
                type="button"
                size="icon"
                variant={
                  voice.voiceState === "recording" ? "destructive" : "outline"
                }
                disabled={isVoiceBusy}
                onPointerDown={voice.onPressStart}
                onPointerUp={voice.onPressEnd}
                onPointerLeave={
                  voice.voiceState === "recording"
                    ? voice.onPressEnd
                    : undefined
                }
                title="押して話す"
              >
                <Mic className="size-4" />
              </Button>
            ) : voice.isActive ? (
              <Button
                type="button"
                size="icon"
                variant="destructive"
                onClick={voice.toggleContinuous}
                title="音声会話を停止"
              >
                <Square className="size-4" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={voice.toggleContinuous}
                disabled={isVoiceBusy}
                title="連続会話を開始"
              >
                <Mic className="size-4" />
              </Button>
            )}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-6 w-9 text-[10px]"
              onClick={() =>
                voice.setMode(
                  voice.mode === "push-to-talk" ? "continuous" : "push-to-talk",
                )
              }
              disabled={voice.isActive}
              title={
                voice.mode === "push-to-talk"
                  ? "連続会話モードに切替"
                  : "Push-to-talkモードに切替"
              }
            >
              {voice.mode === "push-to-talk" ? (
                <Mic className="size-3" />
              ) : (
                <MicOff className="size-3" />
              )}
            </Button>
            <Button
              type="submit"
              size="icon"
              disabled={!inputValue.trim() || isLoading || isVoiceBusy}
            >
              送信
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {isMobile ? "送信ボタンで送信" : "Shift+Enterで改行、Enterで送信"}
        </p>
      </form>
    </div>
  );
}
