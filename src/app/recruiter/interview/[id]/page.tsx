"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { use, useCallback, useEffect, useState } from "react";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { InterviewSidebar } from "@/components/interview";
import type { EvidenceFragment } from "@/components/interview/EvidencePack";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

interface AgentInfo {
  id: string;
  user: {
    id: string;
    name: string;
    avatarPath: string | null;
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
  comment: string | null;
}

interface Interest {
  id: string;
  status: string;
}

interface Summary {
  summary: string | null;
  messageCount: number;
  lastMessageAt: string | null;
  evidence?: SummaryEvidenceFragment[];
}

interface MessageSnippet {
  messageId: string;
  snippet: string;
}

interface SummaryEvidenceFragment extends EvidenceFragment {
  messageSnippets?: MessageSnippet[];
}

interface JobPosting {
  id: string;
  title: string;
  status: string;
}

interface InterviewGuide {
  questions: string[];
  missingInfo: string[];
  focusAreas?: string[];
}

export default function InterviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const [notes, setNotes] = useState<Note[]>([]);
  const [_evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [interest, setInterest] = useState<Interest | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [isExpressingInterest, setIsExpressingInterest] = useState(false);
  const [interestError, setInterestError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [guide, setGuide] = useState<InterviewGuide | null>(null);
  const [isGuideLoading, setIsGuideLoading] = useState(false);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [draftMessage, setDraftMessage] = useState("");
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

  const fetchSummary = useCallback(async () => {
    setIsSummaryLoading(true);
    try {
      const response = await fetch(
        `/api/interview/${resolvedParams.id}/summary`,
      );
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (error) {
      console.error("Failed to fetch summary:", error);
    } finally {
      setIsSummaryLoading(false);
    }
  }, [resolvedParams.id]);

  const fetchJobs = useCallback(async () => {
    try {
      const response = await fetch("/api/recruiter/jobs");
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs);
      }
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
    }
  }, []);

  const fetchGuide = useCallback(
    async (jobId: string) => {
      if (!jobId) {
        setGuide(null);
        return;
      }

      setIsGuideLoading(true);
      try {
        const response = await fetch(
          `/api/interview/${resolvedParams.id}/guide?jobId=${jobId}`,
        );
        if (response.ok) {
          const data = await response.json();
          setGuide(data.guide);
        }
      } catch (error) {
        console.error("Failed to fetch interview guide:", error);
      } finally {
        setIsGuideLoading(false);
      }
    },
    [resolvedParams.id],
  );

  useEffect(() => {
    fetchAgentInfo();
    fetchMessages();
    fetchNotes();
    fetchEvaluation();
    fetchInterest();
    fetchJobs();
  }, [
    fetchAgentInfo,
    fetchMessages,
    fetchNotes,
    fetchEvaluation,
    fetchInterest,
    fetchJobs,
  ]);

  useEffect(() => {
    const jobIdParam = searchParams.get("jobId");
    if (jobIdParam && jobIdParam !== selectedJobId) {
      setSelectedJobId(jobIdParam);
    }
  }, [searchParams, selectedJobId]);

  useEffect(() => {
    if (selectedJobId) {
      fetchGuide(selectedJobId);
    } else {
      setGuide(null);
    }
    setFollowUps([]);
  }, [selectedJobId, fetchGuide]);

  const handleExpressInterest = async () => {
    setIsExpressingInterest(true);
    setInterestError(null);
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
        setInterestError(data.error || "エラーが発生しました");
      }
    } catch (error) {
      console.error("Failed to express interest:", error);
      setInterestError("エラーが発生しました");
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
    setFollowUps([]);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/interview/${resolvedParams.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          jobId: selectedJobId || undefined,
          missingInfo: guide?.missingInfo || [],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "メッセージの送信に失敗しました");
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
        references: data.references || [],
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setFollowUps(data.followUps || []);
    } catch (error) {
      console.error("Chat error:", error);
      const detail =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `申し訳ありません。エラーが発生しました：${detail}`,
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
      <div className="flex items-center justify-center py-20">
        <div className="size-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!agentInfo) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4 text-pretty">
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
              className="size-4 mr-2"
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
          <Avatar className="size-10">
            {agentInfo.user.avatarPath && (
              <AvatarImage
                src={`/api/applicant/avatar/${agentInfo.user.avatarPath}`}
                alt={agentInfo.user.name}
              />
            )}
            <AvatarFallback className="bg-primary text-white">
              {agentInfo.user.name[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-balance">
              {agentInfo.user.name}
            </h1>
            <p className="text-sm text-muted-foreground text-pretty">
              AIエージェントとの面接
            </p>
          </div>
        </div>
        <div className="ml-auto flex flex-col items-end gap-2">
          <div className="flex items-center gap-3">
            <div className="w-56">
              <Select
                value={selectedJobId || "none"}
                onValueChange={(value: string) =>
                  setSelectedJobId(value === "none" ? "" : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="求人を選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">求人を選択</SelectItem>
                  {jobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {interest ? (
              <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                <svg
                  className="size-3.5 mr-1 text-red-500"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                興味表明済み
              </span>
            ) : (
              <Button
                variant="outline"
                onClick={handleExpressInterest}
                disabled={isExpressingInterest}
              >
                <svg
                  className="size-4 mr-1.5"
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
          {interestError && (
            <p className="text-xs text-destructive text-pretty" role="alert">
              {interestError}
            </p>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6 h-[calc(100dvh-16rem)]">
        <div className="lg:col-span-3">
          <Card className="h-full flex flex-col">
            <CardContent className="flex-1 p-0 overflow-hidden">
              <ChatWindow
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                userName={session?.user?.companyName || undefined}
                assistantName={agentInfo.user.name}
                assistantAvatarPath={agentInfo.user.avatarPath}
                placeholder={`${agentInfo.user.name}さんのエージェントに質問...`}
                draftMessage={draftMessage}
                onDraftChange={setDraftMessage}
                followUpSuggestions={selectedJobId ? followUps : []}
                onFollowUpSelect={setDraftMessage}
              />
            </CardContent>
          </Card>
        </div>
        <InterviewSidebar
          skills={allSkills}
          notes={notes}
          onAddNote={handleAddNote}
          evalForm={evalForm}
          onSaveEvaluation={handleSaveEvaluation}
          summary={summary}
          isSummaryLoading={isSummaryLoading}
          messageCount={messages.length}
          onFetchSummary={fetchSummary}
          onScrollToMessage={(messageId) => {
            const element = document.querySelector(
              `[data-message-id="${messageId}"]`,
            );
            element?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }}
          selectedJobId={selectedJobId}
          isGuideLoading={isGuideLoading}
          guide={guide}
          followUps={followUps}
          onInsertMessage={setDraftMessage}
        />
      </div>
    </div>
  );
}
