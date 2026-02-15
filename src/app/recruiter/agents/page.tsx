"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback } from "react";
import { AgentsAllView } from "@/components/agents/AgentsAllView";
import { InterestsView } from "@/components/agents/InterestsView";
import { WatchesView } from "@/components/agents/WatchesView";
import { Button } from "@/components/ui/button";

type ViewType = "all" | "interests" | "watches";

const viewOptions: { value: ViewType; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "interests", label: "興味済み" },
  { value: "watches", label: "ウォッチ中" },
];

function AgentsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const currentView = (searchParams.get("view") as ViewType) || "all";

  const switchView = useCallback(
    (view: ViewType) => {
      const params = new URLSearchParams(searchParams.toString());
      if (view === "all") {
        params.delete("view");
      } else {
        params.set("view", view);
      }
      const query = params.toString();
      router.replace(`/recruiter/agents${query ? `?${query}` : ""}`);
    },
    [router, searchParams],
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">エージェント一覧</h1>
        <p className="text-sm text-muted-foreground mt-1">
          公開されているエージェントと面接を行えます
        </p>
      </div>

      <div className="bg-muted rounded-lg p-1 inline-flex">
        {viewOptions.map((option) => (
          <Button
            key={option.value}
            variant={currentView === option.value ? "default" : "ghost"}
            size="sm"
            onClick={() => switchView(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {currentView === "all" && (
        <AgentsAllView onSwitchToWatches={() => switchView("watches")} />
      )}
      {currentView === "interests" && (
        <InterestsView onSwitchToAll={() => switchView("all")} />
      )}
      {currentView === "watches" && <WatchesView />}
    </div>
  );
}

export default function AgentsListPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="size-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      }
    >
      <AgentsPageContent />
    </Suspense>
  );
}
