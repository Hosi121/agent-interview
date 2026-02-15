"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EvaluationForm } from "./EvaluationForm";
import type { EvidenceFragment } from "./EvidencePack";
import { InterviewGuideTab } from "./InterviewGuideTab";
import { InterviewNotes } from "./InterviewNotes";
import { InterviewSummaryTab } from "./InterviewSummaryTab";

interface MessageSnippet {
  messageId: string;
  snippet: string;
}

interface SummaryEvidenceFragment extends EvidenceFragment {
  messageSnippets?: MessageSnippet[];
}

interface SummaryData {
  summary: string | null;
  messageCount: number;
  lastMessageAt: string | null;
  evidence?: SummaryEvidenceFragment[];
}

interface Note {
  id: string;
  content: string;
  createdAt: string;
}

interface InterviewGuide {
  questions: string[];
  missingInfo: string[];
  focusAreas?: string[];
}

interface EvalFormData {
  overallRating: number;
  technicalRating: number;
  communicationRating: number;
  cultureRating: number;
  comment: string;
}

interface InterviewSidebarProps {
  skills: Set<string>;
  notes: Note[];
  onAddNote: (content: string) => Promise<void>;
  evalForm: EvalFormData;
  onSaveEvaluation: (formData: EvalFormData) => Promise<void>;
  summary: SummaryData | null;
  isSummaryLoading: boolean;
  messageCount: number;
  onFetchSummary: () => void;
  onScrollToMessage: (messageId: string) => void;
  selectedJobId: string;
  isGuideLoading: boolean;
  guide: InterviewGuide | null;
  followUps: string[];
  onInsertMessage: (message: string) => void;
}

export function InterviewSidebar({
  skills,
  notes,
  onAddNote,
  evalForm,
  onSaveEvaluation,
  summary,
  isSummaryLoading,
  messageCount,
  onFetchSummary,
  onScrollToMessage,
  selectedJobId,
  isGuideLoading,
  guide,
  followUps,
  onInsertMessage,
}: InterviewSidebarProps) {
  return (
    <div className="space-y-4 overflow-y-auto">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">候補者情報</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm font-medium">スキル</p>
            <div className="flex flex-wrap gap-1">
              {skills.size > 0 ? (
                Array.from(skills).map((skill) => (
                  <span
                    key={skill}
                    className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground"
                  >
                    {skill}
                  </span>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">情報なし</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">メモ・評価</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="notes">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="notes">メモ</TabsTrigger>
              <TabsTrigger value="evaluation">評価</TabsTrigger>
              <TabsTrigger
                value="summary"
                onClick={() => !summary && onFetchSummary()}
              >
                要約
              </TabsTrigger>
              <TabsTrigger value="guide">面接設計</TabsTrigger>
            </TabsList>
            <TabsContent value="notes" className="mt-3">
              <InterviewNotes notes={notes} onAddNote={onAddNote} />
            </TabsContent>
            <TabsContent value="evaluation" className="mt-3">
              <EvaluationForm
                initialData={evalForm}
                onSave={onSaveEvaluation}
              />
            </TabsContent>
            <TabsContent value="summary" className="mt-3">
              <InterviewSummaryTab
                summary={summary}
                isSummaryLoading={isSummaryLoading}
                messageCount={messageCount}
                onRefresh={onFetchSummary}
                onScrollToMessage={onScrollToMessage}
              />
            </TabsContent>
            <TabsContent value="guide" className="mt-3">
              <InterviewGuideTab
                selectedJobId={selectedJobId}
                isGuideLoading={isGuideLoading}
                guide={guide}
                followUps={followUps}
                onInsertMessage={onInsertMessage}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
