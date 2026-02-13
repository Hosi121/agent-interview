import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PipelineEntry {
  id: string;
  stage: string;
  agent: {
    id: string;
    user: {
      name: string;
      fragments: Array<{
        type: string;
        skills: string[];
        content: string;
      }>;
    };
  };
  job: {
    id: string;
    title: string;
  } | null;
}

interface PipelineCardProps {
  pipeline: PipelineEntry;
  stageLabels: Record<string, string>;
  onStageChange: (pipelineId: string, newStage: string) => void;
  onRemoveClick: (pipeline: PipelineEntry) => void;
}

export function PipelineCard({
  pipeline,
  stageLabels,
  onStageChange,
  onRemoveClick,
}: PipelineCardProps) {
  return (
    <Card className="cursor-pointer">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-sm font-medium">
          {pipeline.agent.user.name}
        </CardTitle>
        {pipeline.job && (
          <p className="text-xs text-muted-foreground text-pretty">
            {pipeline.job.title}
          </p>
        )}
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-2">
        <div className="flex flex-wrap gap-1">
          {[...new Set(pipeline.agent.user.fragments.flatMap((f) => f.skills))]
            .slice(0, 3)
            .map((skill) => (
              <span
                key={skill}
                className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground"
              >
                {skill}
              </span>
            ))}
        </div>
        <Select
          value={pipeline.stage}
          onValueChange={(v: string) => onStageChange(pipeline.id, v)}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(stageLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1">
          <Link
            href={
              pipeline.job
                ? `/recruiter/interview/${pipeline.agent.id}?jobId=${pipeline.job.id}`
                : `/recruiter/interview/${pipeline.agent.id}`
            }
            className="flex-1"
          >
            <Button variant="outline" size="sm" className="w-full text-xs">
              面接
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-destructive"
            onClick={() => onRemoveClick(pipeline)}
          >
            削除
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
