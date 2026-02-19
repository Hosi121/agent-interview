"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Fragment {
  id: string;
  type: string;
  content: string;
  skills: string[];
  keywords: string[];
}

interface FragmentListProps {
  fragments: Fragment[];
  onDelete?: (id: string) => void;
  onCorrect?: (fragment: Fragment) => void;
}

export function FragmentList({
  fragments,
  onDelete,
  onCorrect,
}: FragmentListProps) {
  if (fragments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        記憶のかけらがありません。
        <br />
        AIとチャットして情報を追加してください。
      </p>
    );
  }

  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto">
      {fragments.map((fragment) => (
        <div
          key={fragment.id}
          className="group relative p-3 bg-secondary rounded-lg"
        >
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs">
              {fragment.type}
            </Badge>
            {(onDelete || onCorrect) && (
              <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                {onCorrect && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    onClick={() => onCorrect(fragment)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-destructive hover:text-destructive"
                    onClick={() => onDelete(fragment.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            )}
          </div>
          <p className="text-sm">{fragment.content}</p>
          {fragment.skills.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {fragment.skills.map((skill) => (
                <Badge key={skill} variant="secondary" className="text-xs">
                  {skill}
                </Badge>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
