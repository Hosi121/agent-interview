"use client";

import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FollowUpSuggestions } from "@/components/interview/FollowUpSuggestions";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
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
  placeholder?: string;
  draftMessage?: string;
  onDraftChange?: (value: string) => void;
  followUpSuggestions?: string[];
  onFollowUpSelect?: (suggestion: string) => void;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
}

export function ChatWindow({
  messages,
  onSendMessage,
  isLoading = false,
  userName,
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
              references={message.references}
            />
          ))}
          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-xs">AI</span>
              </div>
              <div className="bg-gray-100 rounded-lg px-4 py-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
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
      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex gap-2">
          <Textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="min-h-[60px] resize-none"
            disabled={isLoading}
          />
          <Button type="submit" disabled={!inputValue.trim() || isLoading}>
            送信
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {isMobile ? "送信ボタンで送信" : "Shift+Enterで改行、Enterで送信"}
        </p>
      </form>
    </div>
  );
}
