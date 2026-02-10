"use client";

import Link from "next/link";
import { type MouseEvent, useCallback, useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  message: string | null;
  createdAt: string;
  updatedAt: string;
  recruiter: {
    id: string;
    companyName: string;
  };
  lastMessage: {
    content: string;
    senderType: "USER" | "RECRUITER";
    createdAt: string;
  } | null;
  messageCount: number;
}

interface DirectMessage {
  id: string;
  content: string;
  senderType: "USER" | "RECRUITER";
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
  EXPRESSED: { label: "興味表明", variant: "secondary" },
  CONTACT_REQUESTED: { label: "連絡先リクエスト中", variant: "outline" },
  CONTACT_DISCLOSED: { label: "連絡先開示済み", variant: "default" },
  DECLINED: { label: "辞退", variant: "destructive" },
};

export default function InboxPage() {
  const [interests, setInterests] = useState<Interest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInterest, setSelectedInterest] = useState<Interest | null>(
    null,
  );
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [messageContent, setMessageContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [accessPreference, setAccessPreference] = useState<
    Record<string, "NONE" | "ALLOW" | "DENY">
  >({});
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [declineTarget, setDeclineTarget] = useState<Interest | null>(null);
  const [declineError, setDeclineError] = useState<string | null>(null);

  const fetchInterests = useCallback(async () => {
    try {
      const response = await fetch("/api/applicant/inbox");
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
      const response = await fetch(
        `/api/applicant/inbox/${interestId}/messages`,
      );
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
    if (selectedInterest) {
      fetchMessages(selectedInterest.id);
    }
  }, [selectedInterest, fetchMessages]);

  const handleSendMessage = async () => {
    if (!selectedInterest || !messageContent.trim()) return;

    setIsSending(true);
    setMessageError(null);
    try {
      const response = await fetch(
        `/api/applicant/inbox/${selectedInterest.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: messageContent }),
        },
      );

      if (response.ok) {
        setMessageContent("");
        fetchMessages(selectedInterest.id);
        fetchInterests(); // 最終メッセージを更新
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

  const handleApproveDisclosure = async (interestId: string) => {
    const preference =
      accessPreference[interestId] === "ALLOW" ? "ALLOW" : "NONE";

    setIsUpdating(interestId);
    setActionErrors((prev) => ({ ...prev, [interestId]: "" }));
    try {
      const response = await fetch(
        `/api/applicant/inbox/${interestId}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preference }),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        setActionErrors((prev) => ({
          ...prev,
          [interestId]: data.error || "エラーが発生しました",
        }));
        return;
      }

      await fetchInterests();
    } catch (error) {
      console.error("Failed to approve disclosure:", error);
      setActionErrors((prev) => ({
        ...prev,
        [interestId]: "エラーが発生しました",
      }));
    } finally {
      setIsUpdating(null);
    }
  };

  const handleDeclineDisclosure = async (interestId: string) => {
    const preference =
      accessPreference[interestId] === "DENY" ? "DENY" : "NONE";

    setDeclineError(null);
    setIsUpdating(interestId);
    try {
      const response = await fetch(
        `/api/applicant/inbox/${interestId}/decline`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preference }),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        setDeclineError(data.error || "エラーが発生しました");
        return;
      }

      await fetchInterests();
      setDeclineTarget(null);
    } catch (error) {
      console.error("Failed to decline disclosure:", error);
      setDeclineError("エラーが発生しました");
    } finally {
      setIsUpdating(null);
    }
  };

  const disclosedCount = interests.filter(
    (i) => i.status === "CONTACT_DISCLOSED",
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-balance">受信箱</h1>
        <p className="text-muted-foreground mt-2 text-pretty">
          企業からの興味表明やメッセージを確認できます
        </p>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>全体</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {interests.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>連絡先開示済み</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {disclosedCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>新規</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {interests.filter((i) => i.status === "EXPRESSED").length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>メッセージ可能</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {disclosedCount}
            </CardTitle>
          </CardHeader>
        </Card>
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
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <p className="text-muted-foreground mb-2 text-pretty">
              まだ企業からの興味表明はありません
            </p>
            <p className="text-sm text-muted-foreground text-pretty">
              エージェントを公開すると、企業から興味表明を受け取れます
            </p>
            <div className="mt-4">
              <Link href="/agent">
                <Button variant="outline" size="sm">
                  エージェントを公開する
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {interests.map((interest) => (
            <Card
              key={interest.id}
              className="hover:shadow-md transition-shadow"
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Avatar className="size-12">
                    <AvatarFallback className="bg-primary text-white">
                      {interest.recruiter.companyName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate text-balance">
                        {interest.recruiter.companyName}
                      </h3>
                      <Badge
                        variant={
                          statusLabels[interest.status]?.variant || "secondary"
                        }
                      >
                        {statusLabels[interest.status]?.label ||
                          interest.status}
                      </Badge>
                    </div>
                    {interest.message && (
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2 text-pretty">
                        {interest.message}
                      </p>
                    )}
                    {interest.lastMessage && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">
                          {interest.lastMessage.senderType === "USER"
                            ? "あなた"
                            : interest.recruiter.companyName}
                          :
                        </span>
                        <span className="truncate text-muted-foreground text-pretty">
                          {interest.lastMessage.content}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="tabular-nums">
                        {new Date(interest.createdAt).toLocaleDateString(
                          "ja-JP",
                        )}
                      </span>
                      {interest.messageCount > 0 && (
                        <span className="tabular-nums">
                          {interest.messageCount}件のメッセージ
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {interest.status === "CONTACT_DISCLOSED" && (
                      <Button
                        size="sm"
                        onClick={() => openMessageDialog(interest)}
                      >
                        メッセージ
                      </Button>
                    )}
                    {interest.status === "CONTACT_REQUESTED" && (
                      <>
                        <select
                          value={accessPreference[interest.id] || "NONE"}
                          onChange={(e) =>
                            setAccessPreference((prev) => ({
                              ...prev,
                              [interest.id]: e.target.value as
                                | "NONE"
                                | "ALLOW"
                                | "DENY",
                            }))
                          }
                          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                        >
                          <option value="NONE">今回のみ</option>
                          <option value="ALLOW">今後この企業は自動許可</option>
                          <option value="DENY">今後この企業は自動拒否</option>
                        </select>
                        <Button
                          size="sm"
                          onClick={() => handleApproveDisclosure(interest.id)}
                          disabled={isUpdating === interest.id}
                        >
                          開示する
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setDeclineTarget(interest);
                            setDeclineError(null);
                          }}
                          disabled={isUpdating === interest.id}
                        >
                          辞退
                        </Button>
                      </>
                    )}
                    {interest.status === "EXPRESSED" && (
                      <Button size="sm" variant="outline" disabled>
                        リクエスト待ち
                      </Button>
                    )}
                    {interest.status === "DECLINED" && (
                      <Button size="sm" variant="outline" disabled>
                        辞退
                      </Button>
                    )}
                    {actionErrors[interest.id] && (
                      <p
                        className="text-xs text-destructive text-pretty"
                        role="alert"
                      >
                        {actionErrors[interest.id]}
                      </p>
                    )}
                  </div>
                </div>
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
              {selectedInterest?.recruiter.companyName}とのメッセージ
            </DialogTitle>
            <DialogDescription>
              企業とメッセージのやり取りができます
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
                      message.senderType === "USER"
                        ? "justify-end"
                        : "justify-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-4 py-2",
                        message.senderType === "USER"
                          ? "bg-primary text-white"
                          : "bg-gray-100",
                      )}
                    >
                      <p className="text-sm text-pretty">{message.content}</p>
                      <p
                        className={cn(
                          "text-xs mt-1 tabular-nums",
                          message.senderType === "USER"
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

          {selectedInterest?.status === "CONTACT_DISCLOSED" && (
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
                <p
                  className="text-xs text-destructive text-pretty"
                  role="alert"
                >
                  {messageError}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!declineTarget}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setDeclineTarget(null);
            setDeclineError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>連絡先開示を辞退しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              辞退すると、この企業からの連絡先リクエストは拒否されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                event.preventDefault();
                if (declineTarget) {
                  handleDeclineDisclosure(declineTarget.id);
                }
              }}
              disabled={isUpdating === declineTarget?.id}
            >
              辞退する
            </AlertDialogAction>
          </AlertDialogFooter>
          {declineError && (
            <p className="text-xs text-destructive text-pretty" role="alert">
              {declineError}
            </p>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
