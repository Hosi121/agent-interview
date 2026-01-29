"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { CoverageIndicator } from "@/components/chat/CoverageIndicator";
import { FinishSuggestion } from "@/components/chat/FinishSuggestion";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ChatCoverageState } from "@/types";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const INITIAL_MESSAGE = `こんにちは！私はあなたのエージェントを作成するためのAIアシスタントです。

あなたの経験やスキル、キャリアについて教えてください。以下のような質問に答えていただくことで、あなたを代理するAIエージェントを作成できます：

- これまでのキャリアや職歴について
- 得意なスキルや技術
- 印象に残っているプロジェクトや成果
- 今後のキャリアの目標

何でも気軽にお話しください！`;

const INITIAL_COVERAGE: ChatCoverageState = {
  percentage: 0,
  isReadyToFinish: false,
  isComplete: false,
  categories: [],
};

export default function ChatPage() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fragmentCount, setFragmentCount] = useState(0);
  const [coverage, setCoverage] = useState<ChatCoverageState>(INITIAL_COVERAGE);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  const fetchInitialData = useCallback(async () => {
    try {
      const response = await fetch("/api/agents/me");
      if (response.ok) {
        const data = await response.json();
        if (data.fragments) {
          setFragmentCount(data.fragments.length);
          // 初期網羅度を計算（APIからcoverageが返ってくる場合に対応）
          if (data.coverage) {
            setCoverage(data.coverage);
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch initial data:", error);
    }
  }, []);

  useEffect(() => {
    setMessages([
      {
        id: "initial",
        role: "assistant",
        content: INITIAL_MESSAGE,
      },
    ]);
    fetchInitialData();
  }, [fetchInitialData]);

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (data.fragmentsExtracted) {
        setFragmentCount((prev) => prev + data.fragmentsExtracted);
      }

      if (data.coverage) {
        setCoverage(data.coverage);
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "申し訳ありません。エラーが発生しました。もう一度お試しください。",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueChat = () => {
    chatInputRef.current?.focus();
  };

  return (
    <div className="grid lg:grid-cols-4 gap-6 h-[calc(100vh-12rem)]">
      <div className="lg:col-span-3 flex flex-col gap-4">
        {coverage.isReadyToFinish && (
          <FinishSuggestion
            coverage={coverage}
            onContinue={handleContinueChat}
          />
        )}
        <Card className="flex-1 flex flex-col min-h-0">
          <CardHeader className="border-b">
            <CardTitle>AIとチャット</CardTitle>
            <CardDescription>
              あなたの経験やスキルについて教えてください
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ChatWindow
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              userName={session?.user?.name || undefined}
              placeholder="経験やスキルについて話してください..."
              inputRef={chatInputRef}
            />
          </CardContent>
        </Card>
      </div>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">抽出された情報</CardTitle>
            <CardDescription>会話から抽出されたあなたの情報</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <p className="text-4xl font-bold text-primary">{fragmentCount}</p>
              <p className="text-sm text-muted-foreground mt-1">記憶のかけら</p>
            </div>
          </CardContent>
        </Card>
        {coverage.categories.length > 0 && (
          <CoverageIndicator coverage={coverage} />
        )}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">ヒント</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5">
                1
              </Badge>
              <p className="text-sm text-muted-foreground">
                具体的なエピソードを交えて話すと、より良いエージェントが作成できます
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5">
                2
              </Badge>
              <p className="text-sm text-muted-foreground">
                数字や実績を含めると、説得力が増します
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5">
                3
              </Badge>
              <p className="text-sm text-muted-foreground">
                困難を乗り越えた経験も重要な情報です
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
