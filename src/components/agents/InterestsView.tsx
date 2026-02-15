"use client";

import { useCallback, useEffect, useState } from "react";
import type { InterestCardInterest } from "@/components/agents/InterestCard";
import { InterestCard } from "@/components/agents/InterestCard";
import type { DirectMessage } from "@/components/inbox";
import { DirectMessageDialog } from "@/components/inbox";
import { Button } from "@/components/ui/button";

interface InterestsViewProps {
  onSwitchToAll: () => void;
}

export function InterestsView({ onSwitchToAll }: InterestsViewProps) {
  const [interests, setInterests] = useState<InterestCardInterest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInterest, setSelectedInterest] =
    useState<InterestCardInterest | null>(null);
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

  const handleRequestContact = async (interest: InterestCardInterest) => {
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
                  status: data.status as InterestCardInterest["status"],
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

  const openMessageDialog = (interest: InterestCardInterest) => {
    setSelectedInterest(interest);
    setMessages([]);
    setMessageContent("");
    setMessageError(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (interests.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="size-12 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
          <svg
            className="size-6 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        </div>
        <p className="text-sm text-muted-foreground">
          まだ興味を表明した候補者はいません
        </p>
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={onSwitchToAll}>
            エージェントを探す
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {interests.map((interest) => (
          <InterestCard
            key={interest.id}
            interest={interest}
            onRequestContact={handleRequestContact}
            onOpenMessages={openMessageDialog}
            isRequesting={isRequesting}
            requestError={requestErrors[interest.id]}
          />
        ))}
      </div>

      <DirectMessageDialog
        open={!!selectedInterest}
        onOpenChange={() => setSelectedInterest(null)}
        title={`${selectedInterest?.user.name}さんとのメッセージ`}
        description="メッセージ送信には3pt消費されます"
        messages={messages}
        messageContent={messageContent}
        onMessageContentChange={setMessageContent}
        onSend={handleSendMessage}
        isSending={isSending}
        messageError={messageError}
        mySenderType="RECRUITER"
        emptyState={
          <p className="text-center text-muted-foreground py-8 text-pretty">
            まだメッセージはありません
          </p>
        }
      />
    </>
  );
}
