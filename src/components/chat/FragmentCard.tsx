"use client";

import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fragmentTypeLabels } from "@/lib/fragment-utils";

interface ExtractedFragmentInfo {
  type: string;
  content: string;
  skills: string[];
}

interface FragmentCardProps {
  fragments: ExtractedFragmentInfo[];
}

export function FragmentCard({ fragments }: FragmentCardProps) {
  return (
    <div className="flex max-w-[80%] animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <div className="rounded-lg border border-amber-300/50 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-950/20 px-3.5 py-2.5 space-y-2">
        <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
          <Sparkles className="size-3.5" />
          <span className="text-xs font-medium">記憶のかけら</span>
        </div>
        <div className="space-y-1.5">
          {fragments.map((fragment, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: 抽出結果は並べ替え不要な一時表示
              key={i}
              className="text-xs space-y-1"
            >
              <div className="flex items-center gap-1 flex-wrap">
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  {fragmentTypeLabels[fragment.type] || fragment.type}
                </Badge>
                {fragment.skills.slice(0, 3).map((skill) => (
                  <Badge
                    key={skill}
                    variant="secondary"
                    className="text-[10px] px-1 py-0"
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
              <p className="text-muted-foreground line-clamp-2">
                {fragment.content}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
