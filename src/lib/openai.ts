import { generateText, Output, streamText } from "ai";
import { z } from "zod";
import { defaultModel } from "./ai";

export async function generateChatResponse(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
): Promise<string> {
  const { text } = await generateText({
    model: defaultModel,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    temperature: 0.7,
    maxOutputTokens: 1000,
  });

  return text;
}

export function streamChatResponse(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  options?: { abortSignal?: AbortSignal },
) {
  return streamText({
    model: defaultModel,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    temperature: 0.7,
    maxOutputTokens: 500,
    frequencyPenalty: 0.4,
    abortSignal: options?.abortSignal,
  });
}

const FRAGMENT_TYPES = [
  "ACHIEVEMENT",
  "ACTION",
  "CHALLENGE",
  "LEARNING",
  "VALUE",
  "EMOTION",
  "FACT",
  "SKILL_USAGE",
] as const;

export const FRAGMENT_CONTENT_TRUNCATE = 100;

const fragmentSchema = z.object({
  fragments: z.array(
    z.object({
      type: z
        .string()
        .transform((v) => v.toUpperCase())
        .pipe(z.enum(FRAGMENT_TYPES))
        .describe(
          "ACHIEVEMENT | ACTION | CHALLENGE | LEARNING | VALUE | EMOTION | FACT | SKILL_USAGE",
        ),
      content: z.string().describe("Fragmentの具体的な内容"),
      skills: z.array(z.string()).default([]).describe("関連スキル"),
      keywords: z.array(z.string()).default([]).describe("関連キーワード"),
    }),
  ),
});

interface ExtractFragmentsOptions {
  existingFragments?: { type: string; content: string }[];
  contextMessages?: string;
}

function buildExtractionInput(
  newMessages: string,
  options: ExtractFragmentsOptions,
): string {
  const sections: string[] = [];

  if (options.existingFragments && options.existingFragments.length > 0) {
    const fragmentsList = options.existingFragments
      .map((f) => {
        const truncated =
          f.content.length > FRAGMENT_CONTENT_TRUNCATE
            ? `${f.content.slice(0, FRAGMENT_CONTENT_TRUNCATE)}…`
            : f.content;
        return `- [${f.type}] ${truncated}`;
      })
      .join("\n");

    sections.push(
      `## 既存Fragment一覧（重複排除用）\n以下は既に抽出済みの情報です。これらと重複する情報は抽出しないでください。\n${fragmentsList}`,
    );
  }

  if (options.contextMessages) {
    sections.push(`## 文脈メッセージ（参考情報）\n${options.contextMessages}`);
  }

  sections.push(
    `## 【新規メッセージ】★ ここから新しい情報を抽出してください ★\n${newMessages}`,
  );

  sections.push(
    "指示: 上記の【新規メッセージ】部分から、既存Fragment一覧と重複しない新しい情報のみを抽出してください。",
  );

  return sections.join("\n\n");
}

export async function extractFragments(
  conversationHistory: string,
  options?: ExtractFragmentsOptions,
): Promise<{
  fragments: {
    type: string;
    content: string;
    skills: string[];
    keywords: string[];
  }[];
}> {
  const baseSystemPrompt = `あなたは求職者との会話から重要な経験や能力を抽出するアシスタントです。
会話から以下のカテゴリに分類できる「記憶のかけら（Fragment）」を抽出してください：

- ACHIEVEMENT: 達成したこと、成果
- ACTION: 実行したアクション、行動
- CHALLENGE: 直面した課題、困難
- LEARNING: 学んだこと、気づき
- VALUE: 大切にしている価値観
- EMOTION: 感じた感情、モチベーション
- FACT: 事実情報（学歴、職歴など）
- SKILL_USAGE: スキルの使用例

各Fragmentには関連するスキルとキーワードも抽出してください。`;

  const systemPrompt = options
    ? `${baseSystemPrompt}\n\n重要: 既存Fragmentと意味的に重複する情報は抽出しないでください。同じ事実を別の言い回しで表現しただけのものも重複とみなしてください。`
    : baseSystemPrompt;

  const userContent = options
    ? buildExtractionInput(conversationHistory, options)
    : conversationHistory;

  try {
    const { output } = await generateText({
      model: defaultModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      output: Output.object({ schema: fragmentSchema }),
      temperature: 0.3,
    });

    return output ?? { fragments: [] };
  } catch {
    return { fragments: [] };
  }
}

export async function generateAgentSystemPrompt(
  fragments: { type: string; content: string }[],
  userName: string,
): Promise<string> {
  const fragmentsSummary = fragments
    .map((f) => `[${f.type}]: ${f.content}`)
    .join("\n");

  const { text } = await generateText({
    model: defaultModel,
    messages: [
      {
        role: "system",
        content: `以下の情報を元に、${userName}さんを代理して採用担当者と対話するAIエージェントのシステムプロンプトを生成してください。
エージェントは${userName}さんの経験や能力を適切に伝え、質問に答えられるようにしてください。`,
      },
      { role: "user", content: fragmentsSummary },
    ],
    temperature: 0.5,
  });

  return text;
}

const interviewGuideSchema = z.object({
  questions: z.array(z.string()).default([]),
  missingInfo: z.array(z.string()).default([]),
  focusAreas: z.array(z.string()).default([]),
});

export async function generateInterviewGuide(input: {
  job: {
    title: string;
    description: string;
    skills: string[];
    experienceLevel: string;
  } | null;
  candidateSummary: string;
  missingInfoHints: string[];
}): Promise<{
  questions: string[];
  missingInfo: string[];
  focusAreas?: string[];
}> {
  const jobContext = input.job
    ? `求人タイトル: ${input.job.title}\n求人概要: ${input.job.description}\n必須スキル: ${input.job.skills.join(", ") || "なし"}\n経験レベル: ${input.job.experienceLevel}`
    : "求人情報は未設定";

  try {
    const { output } = await generateText({
      model: defaultModel,
      output: Output.object({ schema: interviewGuideSchema }),
      temperature: 0.4,
      maxOutputTokens: 1000,
      messages: [
        {
          role: "system",
          content:
            "あなたは採用面接の設計者です。求人と候補者情報に基づき、面接で聞くべき質問テンプレと不足情報を整理してください。",
        },
        {
          role: "user",
          content: `以下の情報をもとに回答してください。

## 求人情報
${jobContext}

## 候補者情報（要約）
${input.candidateSummary}

## 不足情報のヒント
${input.missingInfoHints.length > 0 ? input.missingInfoHints.join("\n") : "特になし"}`,
        },
      ],
    });

    return output ?? { questions: [], missingInfo: [], focusAreas: [] };
  } catch {
    return { questions: [], missingInfo: [], focusAreas: [] };
  }
}

const followUpSchema = z.object({
  followUps: z.array(z.string()).default([]),
});

export async function generateFollowUpQuestions(input: {
  job: {
    title: string;
    description: string;
    skills: string[];
    experienceLevel: string;
  };
  question: string;
  answer: string;
  missingInfo: string[];
}): Promise<string[]> {
  try {
    const { output } = await generateText({
      model: defaultModel,
      output: Output.object({ schema: followUpSchema }),
      temperature: 0.4,
      maxOutputTokens: 400,
      messages: [
        {
          role: "system",
          content:
            "あなたは採用担当者のアシスタントです。直前の回答を深掘りする追加質問を2-3件、簡潔に提案してください。",
        },
        {
          role: "user",
          content: `求人タイトル: ${input.job.title}
求人概要: ${input.job.description}
必須スキル: ${input.job.skills.join(", ") || "なし"}
経験レベル: ${input.job.experienceLevel}

不足情報のヒント:
${input.missingInfo.length > 0 ? input.missingInfo.join("\n") : "特になし"}

採用担当者の質問:
${input.question}

候補者の回答:
${input.answer}`,
        },
      ],
    });

    return output?.followUps ?? [];
  } catch {
    return [];
  }
}

/**
 * GPT-4o VisionでPDFページ画像からテキストを抽出する
 */
export async function extractTextFromPdfWithVision(
  pdfBuffer: Buffer,
): Promise<string> {
  const { pdf } = await import("pdf-to-img");
  const pages: Buffer[] = [];

  const base64Pdf = pdfBuffer.toString("base64");
  const pdfDataUrl = `data:application/pdf;base64,${base64Pdf}`;

  const document = await pdf(pdfDataUrl, { scale: 2.0 });
  for await (const page of document) {
    pages.push(page);
  }

  if (pages.length === 0) {
    throw new Error("PDFからページを抽出できませんでした");
  }

  const maxPages = Math.min(pages.length, 10);
  const pagesToProcess = pages.slice(0, maxPages);

  // 並行数制限付きで Vision API を並列呼び出し
  const CONCURRENCY = 5;
  const extractedTexts: (string | null)[] = new Array(
    pagesToProcess.length,
  ).fill(null);

  for (
    let batchStart = 0;
    batchStart < pagesToProcess.length;
    batchStart += CONCURRENCY
  ) {
    const batch = pagesToProcess.slice(batchStart, batchStart + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (page, batchIndex) => {
        const pageIndex = batchStart + batchIndex;

        const { text } = await generateText({
          model: defaultModel,
          messages: [
            {
              role: "system",
              content: `あなたはOCRアシスタントです。画像内のすべてのテキストを正確に抽出してください。
レイアウトや構造を可能な限り保持し、表がある場合はMarkdown形式で表現してください。
テキストのみを出力し、説明や解釈は加えないでください。`,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `このページ（${pageIndex + 1}/${pages.length}ページ）のテキストを抽出してください。`,
                },
                {
                  type: "image",
                  image: page,
                  providerOptions: {
                    openai: { imageDetail: "high" },
                  },
                },
              ],
            },
          ],
          maxOutputTokens: 4000,
          temperature: 0.1,
        });

        return { pageIndex, text };
      }),
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value.text.trim()) {
        extractedTexts[result.value.pageIndex] =
          `--- ページ ${result.value.pageIndex + 1} ---\n${result.value.text}`;
      }
    }
  }

  const validTexts = extractedTexts.filter((t): t is string => t !== null);

  if (pages.length > maxPages) {
    validTexts.push(
      `\n(注: ${pages.length}ページ中、最初の${maxPages}ページのみ処理しました)`,
    );
  }

  return validTexts.join("\n\n");
}

const matchScoreSchema = z.object({
  score: z.number(),
  reason: z.string(),
});

export async function generateMatchScore(
  conversationSummary: string,
  fragmentsSummary: string,
): Promise<number | null> {
  try {
    const { output } = await generateText({
      model: defaultModel,
      messages: [
        {
          role: "system",
          content: `あなたは採用のマッチング評価を行うアシスタントです。
面接の会話内容と候補者のプロフィール情報を分析し、マッチ度を0-100のスコアで評価してください。`,
        },
        {
          role: "user",
          content: `面接会話:\n${conversationSummary}\n\n候補者情報:\n${fragmentsSummary}`,
        },
      ],
      output: Output.object({ schema: matchScoreSchema }),
      temperature: 0.3,
    });

    return output?.score ?? null;
  } catch {
    return null;
  }
}

export async function generateConversationSummary(
  conversationText: string,
  candidateName: string,
): Promise<string> {
  try {
    const { text } = await generateText({
      model: defaultModel,
      maxOutputTokens: 1000,
      messages: [
        {
          role: "system",
          content:
            "あなたは採用面接の会話を要約するアシスタントです。日本語で簡潔にまとめてください。",
        },
        {
          role: "user",
          content: `以下は採用担当者と候補者（${candidateName}）のAIエージェントとの会話です。
この会話を要約し、以下の観点で整理してください：

1. **会話の概要**: 何について話し合われたか（2-3文）
2. **候補者の強み**: 会話から見えた強みやスキル
3. **確認済み事項**: 会話で確認できた重要な情報
4. **未確認事項**: まだ確認が必要そうな事項（あれば）
5. **全体的な印象**: 候補者の印象（1-2文）

会話内容:
${conversationText}`,
        },
      ],
    });

    return text;
  } catch {
    return "";
  }
}

const comparisonSchema = z.object({
  summary: z.string(),
  comparison: z.object({
    skills: z.string(),
    experience: z.string(),
    fit: z.string(),
  }),
  recommendation: z.string(),
  rankings: z.object({
    overall: z.array(z.string()),
    technical: z.array(z.string()),
    communication: z.array(z.string()),
  }),
});

export async function generateCandidateComparison(
  comparisonPrompt: string,
): Promise<z.infer<typeof comparisonSchema> | { summary: string }> {
  const comparisonMessages = [
    {
      role: "system" as const,
      content:
        "あなたは採用担当者をサポートするアシスタントです。客観的かつ公平に候補者を分析してください。",
    },
    {
      role: "user" as const,
      content: comparisonPrompt,
    },
  ];
  const comparisonOptions = { temperature: 0.5, maxOutputTokens: 2000 };

  try {
    const { output } = await generateText({
      model: defaultModel,
      messages: comparisonMessages,
      output: Output.object({ schema: comparisonSchema }),
      ...comparisonOptions,
    });

    return output ?? { summary: "分析結果を取得できませんでした" };
  } catch {
    try {
      const { text } = await generateText({
        model: defaultModel,
        messages: comparisonMessages,
        ...comparisonOptions,
      });

      return { summary: text };
    } catch {
      return { summary: "分析結果を取得できませんでした" };
    }
  }
}
