"use client";

import { Mic, SendHorizontal, Square } from "lucide-react";
import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FollowUpSuggestions } from "@/components/interview/FollowUpSuggestions";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useVoiceConversation } from "@/hooks/useVoiceConversation";
import { cn } from "@/lib/utils";
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
  }, [messages, isLoading]);

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
      <ScrollArea className="flex-1 min-h-0 p-4">
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
      {voice.error && (
        <div className="px-4 py-1">
          <p className="text-xs text-destructive">{voice.error}</p>
        </div>
      )}
      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex gap-2 items-end">
          <div className="flex-1 min-w-0">
            <Textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className={cn(
                "min-h-[60px] resize-none transition-shadow",
                voice.voiceState === "recording" &&
                  "border-destructive/50 ring-2 ring-destructive/20",
              )}
              disabled={isLoading || isVoiceBusy}
            />
          </div>
          {/* マイクボタン */}
          <div className="relative">
            {voice.isActive && voice.voiceState === "recording" && (
              <span className="absolute inset-0 rounded-md animate-ping bg-destructive/30" />
            )}
            <Button
              type="button"
              size="icon"
              variant={voice.isActive ? "destructive" : "outline"}
              className={cn(
                "relative",
                voice.isActive &&
                  voice.voiceState === "recording" &&
                  "ring-2 ring-destructive/50",
              )}
              onClick={voice.toggleVoice}
              disabled={isVoiceBusy}
              title={voice.isActive ? "音声会話を停止" : "音声会話を開始"}
            >
              {voice.isActive ? (
                <Square className="size-4" />
              ) : (
                <Mic className="size-4" />
              )}
            </Button>
          </div>
          {/* 送信ボタン */}
          <Button
            type="submit"
            size="icon"
            disabled={!inputValue.trim() || isLoading || isVoiceBusy}
            title="送信"
          >
            <SendHorizontal className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-muted-foreground">
            {voice.voiceState === "recording"
              ? formatDuration(voice.duration)
              : voice.voiceState === "transcribing"
                ? "文字起こし中..."
                : voice.voiceState === "waiting"
                  ? "AI応答待ち..."
                  : isMobile
                    ? "送信ボタンで送信"
                    : "Shift+Enterで改行"}
          </span>
        </div>
      </form>
    </div>
  );
}
