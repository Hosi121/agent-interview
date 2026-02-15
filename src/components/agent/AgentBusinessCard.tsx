"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface AgentBusinessCardProps {
  name: string;
  avatarPath?: string | null;
  avatarUrl?: string | null;
  skills?: string[];
  status?: "PUBLIC" | "PRIVATE";
  fragmentCount?: number;
  className?: string;
}

export function AgentBusinessCard({
  name,
  avatarPath,
  avatarUrl,
  skills = [],
  status,
  fragmentCount,
  className,
}: AgentBusinessCardProps) {
  const avatarSrc = avatarUrl
    ? avatarUrl
    : avatarPath
      ? `/api/applicant/avatar/${avatarPath}`
      : undefined;
  return (
    <div
      className={cn(
        "relative w-full max-w-[380px] aspect-[1.75/1] rounded-xl border bg-card p-6 flex flex-col justify-between overflow-hidden",
        "shadow-[0_1px_3px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.02)]",
        className,
      )}
    >
      {/* 藍のアクセントライン */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs tracking-widest text-muted-foreground uppercase">
            Agent
          </p>
          <p className="text-lg font-bold tracking-tight text-foreground">
            {name}
          </p>
        </div>
        <Avatar className="size-12 ring-2 ring-border">
          {avatarSrc && <AvatarImage src={avatarSrc} alt={name} />}
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
            {name[0] || "?"}
          </AvatarFallback>
        </Avatar>
      </div>

      <div className="space-y-2">
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {skills.slice(0, 4).map((skill) => (
              <span
                key={skill}
                className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground"
              >
                {skill}
              </span>
            ))}
            {skills.length > 4 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground tabular-nums">
                +{skills.length - 4}
              </span>
            )}
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {status && (
              <span
                className={cn(
                  "text-[10px] font-medium",
                  status === "PUBLIC"
                    ? "text-primary"
                    : "text-muted-foreground",
                )}
              >
                {status === "PUBLIC" ? "Public" : "Private"}
              </span>
            )}
            {fragmentCount !== undefined && (
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {fragmentCount} fragments
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-widest text-muted-foreground/50 font-medium">
            Metalk
          </span>
        </div>
      </div>
    </div>
  );
}
