"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface InterestCardInterest {
  id: string;
  status: "EXPRESSED" | "CONTACT_REQUESTED" | "CONTACT_DISCLOSED" | "DECLINED";
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    avatarPath: string | null;
  };
  agent: {
    id: string;
  };
}

const statusConfig: Record<string, { label: string; className: string }> = {
  EXPRESSED: {
    label: "興味表明済み",
    className: "bg-primary/10 text-primary",
  },
  CONTACT_REQUESTED: {
    label: "連絡先リクエスト中",
    className: "bg-amber-500/10 text-amber-600",
  },
  CONTACT_DISCLOSED: {
    label: "連絡先開示済み",
    className: "bg-emerald-500/10 text-emerald-600",
  },
  DECLINED: {
    label: "辞退",
    className: "bg-secondary text-secondary-foreground",
  },
};

export interface InterestCardProps {
  interest: InterestCardInterest;
  onRequestContact: (interest: InterestCardInterest) => void;
  onOpenMessages: (interest: InterestCardInterest) => void;
  isRequesting: boolean;
  requestError?: string;
}

export function InterestCard({
  interest,
  onRequestContact,
  onOpenMessages,
  isRequesting,
  requestError,
}: InterestCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Avatar className="size-12">
            {interest.user.avatarPath && (
              <AvatarImage
                src={`/api/applicant/avatar/${interest.user.avatarPath}`}
                alt={interest.user.name}
              />
            )}
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {interest.user.name[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <CardTitle>{interest.user.name}</CardTitle>
            <CardDescription className="tabular-nums">
              {new Date(interest.createdAt).toLocaleDateString("ja-JP")}
            </CardDescription>
          </div>
          <span
            className={cn(
              "text-[10px] font-medium px-2 py-0.5 rounded-md shrink-0",
              statusConfig[interest.status]?.className ??
                "bg-secondary text-secondary-foreground",
            )}
          >
            {statusConfig[interest.status]?.label ?? interest.status}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {interest.status === "CONTACT_DISCLOSED" && (
          <div className="space-y-2 p-3 bg-secondary rounded-lg">
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
              onClick={() => onRequestContact(interest)}
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
              onClick={() => onOpenMessages(interest)}
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
        {requestError && (
          <p className="text-xs text-destructive text-pretty" role="alert">
            {requestError}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
