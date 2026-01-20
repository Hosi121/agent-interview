"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { use, useCallback, useEffect, useState } from "react";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { EvaluationForm, InterviewNotes } from "@/components/interview";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface AgentInfo {
  id: string;
  user: {
    id: string;
    name: string;
  };
  fragments: {
    type: string;
    content: string;
    skills: string[];
  }[];
}

interface Note {
  id: string;
  content: string;
  createdAt: string;
}

interface Evaluation {
  id: string;
  overallRating: number;
  technicalRating: number;
  communicationRating: number;
  cultureRating: number;
  matchScore: number | null;
  comment: string | null;
}

interface Interest {
  id: string;
  status: string;
}

export default function InterviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const [notes, setNotes] = useState<Note[]>([]);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [interest, setInterest] = useState<Interest | null>(null);
  const [isExpressingInterest, setIsExpressingInterest] = useState(false);
  const [evalForm, setEvalForm] = useState({
    overallRating: 3,
    technicalRating: 3,
    communicationRating: 3,
    cultureRating: 3,
    comment: "",
  });

  const fetchAgentInfo = useCallback(async () => {
    try {
      const response = await fetch(`/api/agents/${resolvedParams.id}`);
      if (response.ok) {
        const data = await response.json();
        setAgentInfo(data.agent);
      }
    } catch (error) {
      console.error("Failed to fetch agent info:", error);
    }
  }, [resolvedParams.id]);

  const fetchMessages = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/interview/${resolvedParams.id}/messages`,
      );
      if (response.ok) {
        const data = await response.json();
        setMessages(
          data.messages.map(
            (m: { id: string; senderType: string; content: string }) => ({
              id: m.id,
              role: m.senderType === "RECRUITER" ? "user" : "assistant",
              content: m.content,
            }),
          ),
        );
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setIsFetching(false);
    }
  }, [resolvedParams.id]);

  const fetchNotes = useCallback(async () => {
    try {
      const response = await fetch(`/api/interview/${resolvedParams.id}/notes`);
      if (response.ok) {
        const data = await response.json();
        setNotes(data.notes);
      }
    } catch (error) {
      console.error("Failed to fetch notes:", error);
    }
  }, [resolvedParams.id]);

  const fetchEvaluation = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/interview/${resolvedParams.id}/evaluation`,
      );
      if (response.ok) {
        const data = await response.json();
        if (data.evaluation) {
          setEvaluation(data.evaluation);
          setEvalForm({
            overallRating: data.evaluation.overallRating,
            technicalRating: data.evaluation.technicalRating,
            communicationRating: data.evaluation.communicationRating,
            cultureRating: data.evaluation.cultureRating,
            comment: data.evaluation.comment || "",
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch evaluation:", error);
    }
  }, [resolvedParams.id]);

  const fetchInterest = useCallback(async () => {
    try {
      const response = await fetch("/api/interests");
      if (response.ok) {
        const data = await response.json();
        const found = data.interests.find(
          (i: { agentId: string }) => i.agentId === resolvedParams.id,
        );
        if (found) {
          setInterest(found);
        }
      }
    } catch (error) {
      console.error("Failed to fetch interest:", error);
    }
  }, [resolvedParams.id]);

  useEffect(() => {
    fetchAgentInfo();
    fetchMessages();
    fetchNotes();
    fetchEvaluation();
    fetchInterest();
  }, [
    fetchAgentInfo,
    fetchMessages,
    fetchNotes,
    fetchEvaluation,
    fetchInterest,
  ]);

  const handleExpressInterest = async () => {
    setIsExpressingInterest(true);
    try {
      const response = await fetch("/api/interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: resolvedParams.id }),
      });

      if (response.ok) {
        const data = await response.json();
        setInterest(data.interest);
      } else {
        const data = await response.json();
        alert(data.error || "エラーが発生しました");
      }
    } catch (error) {
      console.error("Failed to express interest:", error);
      alert("エラーが発生しました");
    } finally {
      setIsExpressingInterest(false);
    }
  };

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/interview/${resolvedParams.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
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

  const handleAddNote = async (content: string) => {
    const response = await fetch(`/api/interview/${resolvedParams.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (response.ok) {
      fetchNotes();
    }
  };

  const handleSaveEvaluation = async (formData: typeof evalForm) => {
    const response = await fetch(
      `/api/interview/${resolvedParams.id}/evaluation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      },
    );
    if (response.ok) {
      const data = await response.json();
      setEvaluation(data.evaluation);
    }
  };

  if (isFetching) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  if (!agentInfo) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">
          エージェントが見つかりません
        </p>
        <Link href="/recruiter/agents">
          <Button>エージェント一覧に戻る</Button>
        </Link>
      </div>
    );
  }

  const allSkills = new Set(agentInfo.fragments.flatMap((f) => f.skills));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/recruiter/agents">
          <Button variant="ghost" size="sm">
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            戻る
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary text-white">
              {agentInfo.user.name[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-bold">{agentInfo.user.name}</h1>
            <p className="text-sm text-muted-foreground">
              AIエージェントとの面接
            </p>
          </div>
        </div>
        <div className="ml-auto">
          {interest ? (
            <Badge variant="outline" className="py-1.5 px-3">
              <svg
                className="w-4 h-4 mr-1.5 text-red-500"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              興味表明済み
            </Badge>
          ) : (
            <Button
              variant="outline"
              onClick={handleExpressInterest}
              disabled={isExpressingInterest}
            >
              <svg
                className="w-4 h-4 mr-1.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              興味あり
            </Button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6 h-[calc(100vh-16rem)]">
        <div className="lg:col-span-3">
          <Card className="h-full flex flex-col">
            <CardContent className="flex-1 p-0 overflow-hidden">
              <ChatWindow
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                userName={session?.user?.companyName || undefined}
                placeholder={`${agentInfo.user.name}さんのエージェントに質問...`}
              />
            </CardContent>
          </Card>
        </div>
        <div className="space-y-4 overflow-y-auto">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">候補者情報</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm font-medium">スキル</p>
                <div className="flex flex-wrap gap-1">
                  {allSkills.size > 0 ? (
                    Array.from(allSkills).map((skill) => (
                      <Badge
                        key={skill}
                        variant="secondary"
                        className="text-xs"
                      >
                        {skill}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">情報なし</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">メモ・評価</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="notes">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="notes">メモ</TabsTrigger>
                  <TabsTrigger value="evaluation">評価</TabsTrigger>
                </TabsList>
                <TabsContent value="notes" className="mt-3">
                  <InterviewNotes notes={notes} onAddNote={handleAddNote} />
                </TabsContent>
                <TabsContent value="evaluation" className="mt-3">
                  <EvaluationForm
                    initialData={evalForm}
                    matchScore={evaluation?.matchScore}
                    onSave={handleSaveEvaluation}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
