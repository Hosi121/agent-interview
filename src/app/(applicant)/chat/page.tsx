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

function buildInitialMessage(
  userName: string | undefined,
  fragmentCount: number,
  coverage: ChatCoverageState,
): string {
  const name = userName ? `${userName}さん` : "";

  if (fragmentCount === 0) {
    return `こんにちは${name ? `、${name}` : ""}！私はあなたのエージェントを作成するためのAIアシスタントです。

あなたの経験やスキル、キャリアについて教えてください。以下のような質問に答えていただくことで、あなたを代理するAIエージェントを作成できます：

- これまでのキャリアや職歴について
- 得意なスキルや技術
- 印象に残っているプロジェクトや成果
- 今後のキャリアの目標

何でも気軽にお話しください！`;
  }

  const unfulfilledCategories = coverage.categories.filter((c) => !c.fulfilled);
  const categoryList = unfulfilledCategories
    .map((c) => `- ${c.label}（あと${c.required - c.current}件）`)
    .join("\n");

  if (coverage.percentage < 80) {
    return `おかえりなさい${name ? `、${name}` : ""}！前回までの情報をもとに、続きからお話ししましょう。

現在の情報収集の進捗は${coverage.percentage}%です。${
      categoryList
        ? `以下のカテゴリについてもう少し教えていただけると、より良いエージェントが作れます：

${categoryList}

どのトピックからでも構いません。お話しください！`
        : "どのトピックからでも構いません。お話しください！"
    }`;
  }

  const completionSection = categoryList
    ? `あと少しで完成です。以下の情報があるとさらに良くなります：

${categoryList}`
    : "十分な情報が集まっています。さらに追加したいエピソードがあればお聞かせください。";

  return `おかえりなさい${name ? `、${name}` : ""}！情報収集の進捗は${coverage.percentage}%で、かなり充実してきました。

${completionSection}`;
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
      const response = await fetch("/api/agents/me");
      if (response.ok) {
        const data = await response.json();
        if (data.fragments) {
          const count = data.fragments.length;
          const cov: ChatCoverageState = data.coverage ?? INITIAL_COVERAGE;
          setFragmentCount(count);
          setCoverage(cov);
          setMessages([
            {
              id: "initial",
              role: "assistant",
              content: buildInitialMessage(userName, count, cov),
            },
          ]);
          return;
        }
      }
    } catch (error) {
      console.error("Failed to fetch initial data:", error);
    }
    setMessages([
      {
        id: "initial",
        role: "assistant",
        content: buildInitialMessage(userName, 0, INITIAL_COVERAGE),
      },
    ]);
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
