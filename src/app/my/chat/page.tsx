"use client";

import { X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { CoverageIndicator } from "@/components/chat/CoverageIndicator";
import { DynamicHints } from "@/components/chat/DynamicHints";
import { FinishSuggestion } from "@/components/chat/FinishSuggestion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

interface CorrectFragmentInfo {
  id: string;
  type: string;
  content: string;
  skills: string[];
}

interface PendingCorrectionFragment {
  type: string;
  content: string;
  skills: string[];
  keywords: string[];
  quality: string;
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

function ChatPageInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fragmentCount, setFragmentCount] = useState(0);
  const [coverage, setCoverage] = useState<ChatCoverageState>(INITIAL_COVERAGE);
  const [correctFragment, setCorrectFragment] =
    useState<CorrectFragmentInfo | null>(null);
  const [pendingCorrection, setPendingCorrection] = useState<
    PendingCorrectionFragment[] | null
  >(null);
  const [isApplyingCorrection, setIsApplyingCorrection] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  const correctFragmentId = searchParams.get("correctFragmentId");

  // 修正対象フラグメントの取得
  useEffect(() => {
    if (!correctFragmentId) return;

    (async () => {
      try {
        const res = await fetch(`/api/fragments/${correctFragmentId}`);
        if (res.ok) {
          const data = await res.json();
          setCorrectFragment(data.fragment);
        }
      } catch (error) {
        console.error("Failed to fetch correction fragment:", error);
      }
    })();
  }, [correctFragmentId]);

  const clearCorrectionMode = useCallback(() => {
    setCorrectFragment(null);
    setPendingCorrection(null);
    router.replace("/my/chat", { scroll: false });
  }, [router]);

  const handleConfirmCorrection = useCallback(async () => {
    if (!correctFragment || !pendingCorrection) return;
    setIsApplyingCorrection(true);
    setCorrectionError(null);
    try {
      const response = await fetch(
        `/api/fragments/${correctFragment.id}/correct`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newFragments: pendingCorrection }),
        },
      );
      if (response.ok) {
        setFragmentCount((prev) => prev - 1 + pendingCorrection.length);
        setPendingCorrection(null);
        clearCorrectionMode();
      } else {
        setCorrectionError("修正の適用に失敗しました");
      }
    } catch (error) {
      console.error("Failed to apply correction:", error);
      setCorrectionError("修正の適用に失敗しました");
    } finally {
      setIsApplyingCorrection(false);
    }
  }, [correctFragment, pendingCorrection, clearCorrectionMode]);

  const handleDismissCorrection = useCallback(() => {
    setPendingCorrection(null);
    setCorrectionError(null);
  }, []);

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
    setPendingCorrection(null);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const body: { message: string; correctFragmentId?: string } = {
        message: content,
      };
      if (correctFragment) {
        body.correctFragmentId = correctFragment.id;
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
            if (meta.pendingCorrection) {
              setPendingCorrection(meta.pendingCorrection);
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
        {correctFragment && (
          <div className="flex items-start gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">修正モード</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs shrink-0">
                  {correctFragment.type}
                </Badge>
                <p className="text-sm text-muted-foreground truncate">
                  {correctFragment.content}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              aria-label="修正モードを終了"
              onClick={clearCorrectionMode}
            >
              <X className="size-4" />
            </Button>
          </div>
        )}
        {pendingCorrection && correctFragment && (
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <p className="text-sm font-medium">修正内容の確認</p>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">修正前</p>
              <div className="p-2 bg-secondary rounded text-sm">
                <Badge variant="outline" className="text-xs mb-1">
                  {correctFragment.type}
                </Badge>
                <p className="mt-1">{correctFragment.content}</p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">修正後</p>
              {pendingCorrection.map((f, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: 抽出結果は並べ替え不要な一時表示
                <div key={i} className="p-2 bg-secondary rounded text-sm">
                  <Badge variant="outline" className="text-xs mb-1">
                    {f.type}
                  </Badge>
                  <p className="mt-1">{f.content}</p>
                  {f.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {f.skills.map((skill) => (
                        <Badge
                          key={skill}
                          variant="secondary"
                          className="text-xs"
                        >
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {correctionError && (
              <p className="text-xs text-destructive" role="alert">
                {correctionError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDismissCorrection}
                disabled={isApplyingCorrection}
              >
                やり直す
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmCorrection}
                disabled={isApplyingCorrection}
              >
                {isApplyingCorrection ? "適用中..." : "この内容で確定"}
              </Button>
            </div>
          </div>
        )}
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
              {correctFragment
                ? "修正したい内容をAIに伝えてください"
                : "あなたの経験やスキルについて教えてください"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ChatWindow
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              userName={session?.user?.name || undefined}
              placeholder={
                correctFragment
                  ? "修正内容を入力してください..."
                  : "経験やスキルについて話してください..."
              }
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

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="size-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      }
    >
      <ChatPageInner />
    </Suspense>
  );
}
