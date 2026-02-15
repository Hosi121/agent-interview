"use client";

import { Badge } from "@/components/ui/badge";

interface Fragment {
  id: string;
  type: string;
  content: string;
  skills: string[];
  keywords: string[];
}

interface FragmentListProps {
  fragments: Fragment[];
}

export function FragmentList({ fragments }: FragmentListProps) {
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
        <div key={fragment.id} className="p-3 bg-secondary rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs">
              {fragment.type}
            </Badge>
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
