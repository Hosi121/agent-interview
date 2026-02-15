"use client";

import { useState } from "react";
import { ChatWindow } from "@/components/chat/ChatWindow";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PreviewMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface AgentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName?: string;
  avatarPath?: string | null;
}

export function AgentPreviewDialog({
  open,
  onOpenChange,
  userName,
  avatarPath,
}: AgentPreviewDialogProps) {
  const [messages, setMessages] = useState<PreviewMessage[]>([
    {
      id: "initial",
      role: "assistant",
      content:
        "こんにちは！私はあなたのAIエージェントです。採用担当者からの質問を想定して、何でも聞いてみてください。",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async (content: string) => {
    const userMessage: PreviewMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/agents/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage]
            .filter((m) => m.id !== "initial")
            .map((m) => ({
              role: m.role,
              content: m.content,
            })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();
      const assistantMessage: PreviewMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Preview error:", error);
      const errorMessage: PreviewMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "エラーが発生しました。もう一度お試しください。",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setMessages([
        {
          id: "initial",
          role: "assistant",
          content:
            "こんにちは！私はあなたのAIエージェントです。採用担当者からの質問を想定して、何でも聞いてみてください。",
        },
      ]);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle>エージェントプレビュー</DialogTitle>
          <DialogDescription>
            採用担当者の視点でエージェントをテストできます
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          <ChatWindow
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            assistantName={userName}
            assistantAvatarPath={avatarPath}
            placeholder="採用担当者として質問してみてください..."
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
