"use client";

import { useCallback, useEffect, useState } from "react";
import { AgentPreviewDialog, FragmentList } from "@/components/agent";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

interface AgentProfile {
  id: string;
  systemPrompt: string;
  status: "PRIVATE" | "PUBLIC";
  createdAt: string;
  updatedAt: string;
}

interface Fragment {
  id: string;
  type: string;
  content: string;
  skills: string[];
  keywords: string[];
}

export default function AgentPage() {
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [fragments, setFragments] = useState<Fragment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [userName, setUserName] = useState<string>("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);

  const fetchAgent = useCallback(async () => {
    try {
      const response = await fetch("/api/agents/me");
      if (response.ok) {
        const data = await response.json();
        setAgent(data.agent);
        setFragments(data.fragments || []);
      }
    } catch (error) {
      console.error("Failed to fetch agent:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchUserProfile = useCallback(async () => {
    try {
      const response = await fetch("/api/applicant/settings");
      if (response.ok) {
        const data = await response.json();
        setUserName(data.settings.name);
        setAvatarPath(data.settings.avatarPath);
      }
    } catch (error) {
      console.error("Failed to fetch user profile:", error);
    }
  }, []);

  useEffect(() => {
    fetchAgent();
    fetchUserProfile();
  }, [fetchAgent, fetchUserProfile]);

  const handleGeneratePrompt = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/agents/generate", {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        setAgent(data.agent);
      }
    } catch (error) {
      console.error("Failed to generate prompt:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!agent) return;

    setIsUpdating(true);
    try {
      const newStatus = agent.status === "PRIVATE" ? "PUBLIC" : "PRIVATE";
      const response = await fetch("/api/agents/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        const data = await response.json();
        setAgent(data.agent);
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdatePrompt = async (newPrompt: string) => {
    if (!agent) return;

    try {
      const response = await fetch("/api/agents/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt: newPrompt }),
      });

      if (response.ok) {
        const data = await response.json();
        setAgent(data.agent);
      }
    } catch (error) {
      console.error("Failed to update prompt:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">エージェント設定</h1>
          <p className="text-muted-foreground mt-2">
            あなたを代理するAIエージェントの設定を行います
          </p>
        </div>
        {agent && (
          <Badge
            variant={agent.status === "PUBLIC" ? "default" : "outline"}
            className="text-sm"
          >
            {agent.status === "PUBLIC" ? "公開中" : "非公開"}
          </Badge>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>システムプロンプト</CardTitle>
              <CardDescription>
                エージェントの振る舞いを定義するプロンプトです
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {agent ? (
                <>
                  <Textarea
                    value={agent.systemPrompt}
                    onChange={(e) =>
                      setAgent({ ...agent, systemPrompt: e.target.value })
                    }
                    className="min-h-[200px]"
                    placeholder="エージェントのシステムプロンプト..."
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleUpdatePrompt(agent.systemPrompt)}
                    >
                      保存
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleGeneratePrompt}
                      disabled={isGenerating}
                    >
                      {isGenerating ? "生成中..." : "再生成"}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    エージェントがまだ作成されていません
                  </p>
                  <Button
                    onClick={handleGeneratePrompt}
                    disabled={isGenerating}
                  >
                    {isGenerating ? "生成中..." : "エージェントを生成"}
                  </Button>
                  <p className="text-sm text-muted-foreground mt-2">
                    AIチャットで収集した情報を元にエージェントを生成します
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {agent && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>プレビュー</CardTitle>
                  <CardDescription>
                    エージェントの動作を確認できます
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => setIsPreviewOpen(true)}
                    variant="outline"
                  >
                    エージェントをテスト
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>公開設定</CardTitle>
                  <CardDescription>
                    エージェントを公開すると、採用担当者が面接できるようになります
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={handleToggleStatus}
                    disabled={isUpdating}
                    variant={
                      agent.status === "PUBLIC" ? "destructive" : "default"
                    }
                  >
                    {isUpdating
                      ? "更新中..."
                      : agent.status === "PUBLIC"
                        ? "非公開にする"
                        : "公開する"}
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">収集された記憶のかけら</CardTitle>
              <CardDescription>AIチャットから抽出された情報</CardDescription>
            </CardHeader>
            <CardContent>
              <FragmentList fragments={fragments} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">統計</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">記憶のかけら</span>
                  <span className="font-medium">{fragments.length}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">スキル</span>
                  <span className="font-medium">
                    {new Set(fragments.flatMap((f) => f.skills)).size}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AgentPreviewDialog
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        userName={userName}
        avatarPath={avatarPath}
      />
    </div>
  );
}
