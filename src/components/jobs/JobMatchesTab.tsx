import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Match {
  id: string;
  score: number;
  scoreDetails: {
    skill: number;
    keyword: number;
    experience: number;
  };
  agent: {
    id: string;
    user: {
      name: string;
    };
  };
}

interface JobMatchesTabProps {
  matches: Match[];
  matchCount: number;
  jobId: string;
  isMatching: boolean;
  onRunMatching: () => void;
  onAddToPipeline: (agentId: string) => void;
}

export function JobMatchesTab({
  matches,
  matchCount,
  jobId,
  isMatching,
  onRunMatching,
  onAddToPipeline,
}: JobMatchesTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground text-pretty tabular-nums">
          マッチした候補者: {matchCount}名
        </p>
        <Button onClick={onRunMatching} disabled={isMatching}>
          {isMatching ? "計算中..." : "マッチング再計算"}
        </Button>
      </div>

      {matches.length === 0 ? (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="py-16 space-y-3 flex flex-col items-center text-center">
            <div className="size-10 rounded-lg bg-secondary flex items-center justify-center">
              <svg
                className="size-5 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128H5.228A2 2 0 0 1 3.24 17.1a4.125 4.125 0 0 1 3.135-5.354M12.75 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm8.25 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
                />
              </svg>
            </div>
            <div className="h-px w-16 bg-gradient-to-r from-transparent via-border to-transparent" />
            <p className="text-muted-foreground text-sm text-pretty">
              まだマッチング候補がいません
            </p>
            <Button onClick={onRunMatching} disabled={isMatching}>
              マッチングを実行
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b">
            <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
              マッチ候補
            </span>
            <span className="text-[10px] tracking-widest text-muted-foreground ml-2 tabular-nums">
              {matches.length}
            </span>
          </div>
          {matches.map((match, index) => (
            <div
              key={match.id}
              className={cn(
                "px-5 py-4 hover:bg-secondary/30 transition-colors",
                index < matches.length - 1 && "border-b",
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{match.agent.user.name}</p>
                  <div className="flex gap-4 text-sm text-muted-foreground mt-1 tabular-nums">
                    <span>総合: {Math.round(match.score * 100)}%</span>
                    <span>
                      スキル: {Math.round(match.scoreDetails.skill * 100)}%
                    </span>
                    <span>
                      経験: {Math.round(match.scoreDetails.experience * 100)}%
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/recruiter/interview/${match.agent.id}?jobId=${jobId}`}
                  >
                    <Button variant="outline" size="sm">
                      面接
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    onClick={() => onAddToPipeline(match.agent.id)}
                  >
                    パイプラインに追加
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
