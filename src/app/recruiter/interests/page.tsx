"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Interest {
  id: string;
  status: "EXPRESSED" | "CONTACT_REQUESTED" | "CONTACT_DISCLOSED" | "DECLINED";
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
  agent: {
    id: string;
  };
}

interface DirectMessage {
  id: string;
  content: string;
  senderType: "RECRUITER" | "USER";
  createdAt: string;
  recruiter: { companyName: string } | null;
  user: { name: string } | null;
}

const statusLabels: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
  }
> = {
  EXPRESSED: { label: "興味表明済み", variant: "secondary" },
  CONTACT_REQUESTED: { label: "連絡先リクエスト中", variant: "outline" },
  CONTACT_DISCLOSED: { label: "連絡先開示済み", variant: "default" },
  DECLINED: { label: "辞退", variant: "destructive" },
};

export default function InterestsPage() {
  const [interests, setInterests] = useState<Interest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInterest, setSelectedInterest] = useState<Interest | null>(
    null,
  );
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [messageContent, setMessageContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestErrors, setRequestErrors] = useState<Record<string, string>>(
    {},
  );
  const [messageError, setMessageError] = useState<string | null>(null);

  const fetchInterests = useCallback(async () => {
    try {
      const response = await fetch("/api/interests");
      if (response.ok) {
        const data = await response.json();
        setInterests(data.interests);
      }
    } catch (error) {
      console.error("Failed to fetch interests:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchMessages = useCallback(async (interestId: string) => {
    try {
      const response = await fetch(`/api/interests/${interestId}/messages`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages);
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    }
  }, []);

  useEffect(() => {
    fetchInterests();
  }, [fetchInterests]);

  useEffect(() => {
    if (selectedInterest?.status === "CONTACT_DISCLOSED") {
      fetchMessages(selectedInterest.id);
    }
  }, [selectedInterest, fetchMessages]);

  const handleRequestContact = async (interest: Interest) => {
    setIsRequesting(true);
    setRequestErrors((prev) => ({ ...prev, [interest.id]: "" }));
    try {
      const response = await fetch(`/api/interests/${interest.id}/request`, {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        setInterests((prev) =>
          prev.map((i) =>
            i.id === interest.id
              ? {
                  ...i,
                  status: data.status as Interest["status"],
                  user: data.contact
                    ? {
                        ...i.user,
                        email: data.contact.email,
                        phone: data.contact.phone,
                      }
                    : i.user,
                }
              : i,
          ),
        );
      } else {
        const data = await response.json();
        setRequestErrors((prev) => ({
          ...prev,
          [interest.id]: data.error || "エラーが発生しました",
        }));
      }
    } catch (error) {
      console.error("Failed to request contact:", error);
      setRequestErrors((prev) => ({
        ...prev,
        [interest.id]: "エラーが発生しました",
      }));
    } finally {
      setIsRequesting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedInterest || !messageContent.trim()) return;

    setIsSending(true);
    setMessageError(null);
    try {
      const response = await fetch(
        `/api/interests/${selectedInterest.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: messageContent }),
        },
      );

      if (response.ok) {
        setMessageContent("");
        fetchMessages(selectedInterest.id);
      } else {
        const data = await response.json();
        setMessageError(data.error || "エラーが発生しました");
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessageError("エラーが発生しました");
    } finally {
      setIsSending(false);
    }
  };

  const openMessageDialog = (interest: Interest) => {
    setSelectedInterest(interest);
    setMessages([]);
    setMessageContent("");
    setMessageError(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-balance">興味リスト</h1>
        <p className="text-muted-foreground mt-2 text-pretty">
          興味を表明した候補者の一覧です
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-pretty">読み込み中...</p>
        </div>
      ) : interests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <svg
              className="size-12 mx-auto text-muted-foreground mb-4"
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
            <p className="text-muted-foreground text-pretty">
              まだ興味を表明した候補者はいません
            </p>
            <div className="mt-4">
              <Link href="/recruiter/agents">
                <Button variant="outline" size="sm">
                  エージェントを探す
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {interests.map((interest) => (
            <Card key={interest.id}>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <Avatar className="size-12">
                    <AvatarFallback className="bg-primary text-white text-lg">
                      {interest.user.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CardTitle>{interest.user.name}</CardTitle>
                    <CardDescription className="tabular-nums">
                      {new Date(interest.createdAt).toLocaleDateString("ja-JP")}
                    </CardDescription>
                  </div>
                  <Badge
                    variant={
                      statusLabels[interest.status]?.variant || "secondary"
                    }
                  >
                    {statusLabels[interest.status]?.label || interest.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {interest.status === "CONTACT_DISCLOSED" && (
                  <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <svg
                        className="size-4 text-muted-foreground"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                      <span>{interest.user.email || "未設定"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <svg
                        className="size-4 text-muted-foreground"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                      </svg>
                      <span>{interest.user.phone || "未設定"}</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  {interest.status === "EXPRESSED" && (
                    <Button
                      onClick={() => handleRequestContact(interest)}
                      disabled={isRequesting}
                      className="flex-1"
                    >
                      連絡先をリクエスト
                    </Button>
                  )}
                  {interest.status === "CONTACT_REQUESTED" && (
                    <Button variant="outline" className="flex-1" disabled>
                      承認待ち
                    </Button>
                  )}
                  {interest.status === "CONTACT_DISCLOSED" && (
                    <Button
                      onClick={() => openMessageDialog(interest)}
                      variant="outline"
                      className="flex-1"
                    >
                      メッセージを送る
                    </Button>
                  )}
                  {interest.status === "DECLINED" && (
                    <Button variant="outline" className="flex-1" disabled>
                      辞退
                    </Button>
                  )}
                </div>
                {requestErrors[interest.id] && (
                  <p
                    className="text-xs text-destructive text-pretty"
                    role="alert"
                  >
                    {requestErrors[interest.id]}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={!!selectedInterest}
        onOpenChange={() => setSelectedInterest(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedInterest?.user.name}さんとのメッセージ
            </DialogTitle>
            <DialogDescription>
              メッセージ送信には3pt消費されます
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-80 border rounded-lg p-4">
            {messages.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-pretty">
                まだメッセージはありません
              </p>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex",
                      message.senderType === "RECRUITER"
                        ? "justify-end"
                        : "justify-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-4 py-2",
                        message.senderType === "RECRUITER"
                          ? "bg-primary text-white"
                          : "bg-gray-100",
                      )}
                    >
                      <p className="text-sm text-pretty">{message.content}</p>
                      <p
                        className={cn(
                          "text-xs mt-1 tabular-nums",
                          message.senderType === "RECRUITER"
                            ? "text-white/70"
                            : "text-muted-foreground",
                        )}
                      >
                        {new Date(message.createdAt).toLocaleString("ja-JP")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="space-y-2">
            <div className="flex gap-2">
              <Textarea
                placeholder="メッセージを入力..."
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                className="flex-1"
                rows={2}
              />
              <Button
                onClick={handleSendMessage}
                disabled={isSending || !messageContent.trim()}
              >
                送信
              </Button>
            </div>
            {messageError && (
              <p className="text-xs text-destructive text-pretty" role="alert">
                {messageError}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
