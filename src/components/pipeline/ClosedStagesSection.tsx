import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ClosedPipelineEntry {
  id: string;
  agent: {
    id: string;
    user: {
      name: string;
    };
  };
  job: {
    id: string;
    title: string;
  } | null;
}

interface ClosedStagesSectionProps {
  grouped: Record<string, ClosedPipelineEntry[]>;
  counts: Record<string, number>;
  stageLabels: Record<string, string>;
  stageColors: Record<string, string>;
}

const closedStages = ["HIRED", "REJECTED", "WITHDRAWN"];

export function ClosedStagesSection({
  grouped,
  counts,
  stageLabels,
  stageColors,
}: ClosedStagesSectionProps) {
  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold mb-4 text-balance">クローズド</h2>
      <div className="grid grid-cols-3 gap-4">
        {closedStages.map((stage) => (
          <Card key={stage}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <span
                  className={cn(
                    "text-[10px] font-medium px-2 py-0.5 rounded-md",
                    stageColors[stage],
                  )}
                >
                  {stageLabels[stage]}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {counts[stage] || 0}名
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(grouped[stage] || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-pretty">
                  候補者がいません
                </p>
              ) : (
                <div className="space-y-2">
                  {(grouped[stage] || []).slice(0, 3).map((pipeline) => (
                    <div
                      key={pipeline.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>{pipeline.agent.user.name}</span>
                      {pipeline.job && (
                        <span className="text-muted-foreground text-xs text-pretty">
                          {pipeline.job.title}
                        </span>
                      )}
                    </div>
                  ))}
                  {(grouped[stage] || []).length > 3 && (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      他 {(grouped[stage] || []).length - 3}名
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
