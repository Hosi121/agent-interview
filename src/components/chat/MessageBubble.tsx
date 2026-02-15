"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface FragmentReference {
  id: string;
  type: string;
  content: string;
  skills: string[];
}

interface MessageBubbleProps {
  content: string;
  role: "user" | "assistant";
  senderName?: string;
  assistantName?: string;
  assistantAvatarPath?: string | null;
  references?: FragmentReference[];
  messageId?: string;
}

const fragmentTypeLabels: Record<string, string> = {
  ACHIEVEMENT: "実績",
  ACTION: "行動",
  CHALLENGE: "課題",
  LEARNING: "学び",
  VALUE: "価値観",
  EMOTION: "感情",
  FACT: "事実",
  SKILL_USAGE: "スキル活用",
};

export function MessageBubble({
  content,
  role,
  senderName,
  assistantName,
  assistantAvatarPath,
  references,
  messageId,
}: MessageBubbleProps) {
  const isUser = role === "user";
  const [isOpen, setIsOpen] = useState(false);
  const hasReferences = references && references.length > 0;

  return (
    <div
      className={cn(
        "flex gap-2.5 max-w-[80%]",
        isUser ? "ml-auto flex-row-reverse" : "",
      )}
      data-message-id={messageId}
    >
      <Avatar className="size-7 flex-shrink-0 mt-0.5">
        {!isUser && assistantAvatarPath && (
          <AvatarImage
            src={`/api/applicant/avatar/${assistantAvatarPath}`}
            alt={assistantName || "AI"}
          />
        )}
        <AvatarFallback
          className={cn(
            "text-xs",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-primary/10 text-primary",
          )}
        >
          {isUser ? senderName?.[0] || "U" : assistantName?.[0] || "AI"}
        </AvatarFallback>
      </Avatar>
      <div className="space-y-1.5">
        {!isUser && assistantName && (
          <p className="text-xs text-muted-foreground ml-1">{assistantName}</p>
        )}
        <div
          className={cn(
            "rounded-lg px-3.5 py-2",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-foreground",
          )}
        >
          <p className="text-sm whitespace-pre-wrap leading-relaxed">
            {content}
          </p>
        </div>
        {hasReferences && !isUser && (
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-1">
              <svg
                className={cn(
                  "size-3 transition-transform",
                  isOpen && "rotate-90",
                )}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
              回答の根拠 ({references.length}件)
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1.5">
              <div className="space-y-1.5 pl-2 border-l-2 border-border">
                {references.map((ref) => (
                  <div
                    key={ref.id}
                    className="text-xs bg-secondary rounded p-2 space-y-1"
                  >
                    <div className="flex items-center gap-1">
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1 py-0"
                      >
                        {fragmentTypeLabels[ref.type] || ref.type}
                      </Badge>
                      {ref.skills.slice(0, 3).map((skill) => (
                        <Badge
                          key={skill}
                          variant="secondary"
                          className="text-[10px] px-1 py-0"
                        >
                          {skill}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-muted-foreground">{ref.content}</p>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}
