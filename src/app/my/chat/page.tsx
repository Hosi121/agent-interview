"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { CoverageIndicator } from "@/components/chat/CoverageIndicator";
import { DynamicHints } from "@/components/chat/DynamicHints";
import { FinishSuggestion } from "@/components/chat/FinishSuggestion";
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

function buildInitialMessage(
  userName: string | undefined,
  fragmentCount: number,
): string {
  const name = userName ? `${userName}さん` : "";

  if (fragmentCount === 0) {
    return `こんにちは${name ? `、${name}` : ""}！あなたのキャリアを代わりに伝えてくれるAIエージェントを一緒に作りましょう。

まずは気軽に、これまでのお仕事やご経験について聞かせてください。印象に残っているプロジェクトの話でも、今やっていることでも、何でも大丈夫です。`;
  }

  // Fragmentあり（書類アップロード等）だが初チャットの場合
  return `こんにちは${name ? `、${name}` : ""}！すでにいくつかの情報をいただいています。ここからはもう少し詳しくお話を聞かせてください。

たとえば、お仕事の中で特に印象に残っているプロジェクトや、ご自身が工夫されたことなどがあれば教えてください。`;
}

const INITIAL_COVERAGE: ChatCoverageState = {
  percentage: 0,
  isReadyToFinish: false,
  isComplete: false,
  categories: [],
};

async function* parseSSE(response: Response) {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const eventStr of events) {
      const lines = eventStr.split("\n");
      let event = "";
      const dataLines: string[] = [];
      for (const line of lines) {
        if (line.startsWith("event: ")) event = line.slice(7);
        if (line.startsWith("data: ")) dataLines.push(line.slice(6));
      }
      if (event) yield { event, data: dataLines.join("\n") };
    }
  }
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fragmentCount, setFragmentCount] = useState(0);
  const [coverage, setCoverage] = useState<ChatCoverageState>(INITIAL_COVERAGE);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  const fetchInitialData = useCallback(async (userName: string | undefined) => {
    try {
      const [agentRes, messagesRes] = await Promise.all([
        fetch("/api/agents/me"),
        fetch("/api/chat/messages"),
      ]);

      let fetchedFragmentCount = 0;
      let cov: ChatCoverageState = INITIAL_COVERAGE;

      if (agentRes.ok) {
        const data = await agentRes.json();
        if (data.fragments) {
          fetchedFragmentCount = data.fragments.length;
          cov = data.coverage ?? INITIAL_COVERAGE;
        }
      }

      setFragmentCount(fetchedFragmentCount);
      setCoverage(cov);

      // 永続化済みメッセージがあればそれを復元
      if (messagesRes.ok) {
        const { messages: dbMessages } = await messagesRes.json();
        if (dbMessages && dbMessages.length > 0) {
          const restored: Message[] = dbMessages.map(
            (m: { id: string; senderType: string; content: string }) => ({
              id: m.id,
              role: m.senderType === "USER" ? "user" : "assistant",
              content: m.content,
            }),
          );
          setMessages(restored);
          return;
        }
      }

      // メッセージなし → 初回挨拶
      setMessages([
        {
          id: "initial",
          role: "assistant",
          content: buildInitialMessage(userName, fetchedFragmentCount),
        },
      ]);
    } catch (error) {
      console.error("Failed to fetch initial data:", error);
      setMessages([
        {
          id: "initial",
          role: "assistant",
          content: buildInitialMessage(userName, 0),
        },
      ]);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    fetchInitialData(session?.user?.name ?? undefined);
  }, [fetchInitialData, status, session?.user?.name]);

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
        body: JSON.stringify({ message: content }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      if (
        !response.headers.get("content-type")?.includes("text/event-stream")
      ) {
        throw new Error("Unexpected response format");
      }

      const assistantId = crypto.randomUUID();
      let accumulatedText = "";

      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      for await (const { event, data } of parseSSE(response)) {
        try {
          if (event === "text") {
            accumulatedText += JSON.parse(data);
            const currentText = accumulatedText;
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: currentText,
              };
              return updated;
            });
          } else if (event === "metadata") {
            const meta = JSON.parse(data);
            if (meta.fragmentsExtracted) {
              setFragmentCount((prev) => prev + meta.fragmentsExtracted);
            }
            if (meta.coverage) {
              setCoverage(meta.coverage);
            }
          } else if (event === "error") {
            const errorData = JSON.parse(data);
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              updated[updated.length - 1] = {
                ...last,
                content: accumulatedText
                  ? `${accumulatedText}\n\n${errorData.message}`
                  : errorData.message,
              };
              return updated;
            });
          }
        } catch (e) {
          console.error("SSE event parse error:", e);
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorContent =
        "申し訳ありません。エラーが発生しました。もう一度お試しください。";
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.content) {
          const updated = [...prev];
          updated[updated.length - 1] = { ...last, content: errorContent };
          return updated;
        }
        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant" as const,
            content: errorContent,
          },
        ];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueChat = () => {
    chatInputRef.current?.focus();
  };

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-4 gap-4 lg:gap-6 h-[calc(100vh-12rem)]">
      <div className="lg:col-span-3 flex flex-col gap-4 min-h-0 flex-1 order-2 lg:order-none">
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
      <div className="space-y-3 lg:space-y-4 overflow-y-auto shrink-0 max-h-[25vh] lg:max-h-none order-1 lg:order-none">
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
        <DynamicHints coverage={coverage} />
      </div>
    </div>
  );
}
