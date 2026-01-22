import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateChatResponse(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    temperature: 0.7,
    max_tokens: 1000,
  });

  return response.choices[0]?.message?.content || "";
}

export async function extractFragments(conversationHistory: string): Promise<{
  fragments: {
    type: string;
    content: string;
    skills: string[];
    keywords: string[];
  }[];
}> {
  const systemPrompt = `あなたは求職者との会話から重要な経験や能力を抽出するアシスタントです。
会話から以下のカテゴリに分類できる「記憶のかけら（Fragment）」を抽出してください：

- ACHIEVEMENT: 達成したこと、成果
- ACTION: 実行したアクション、行動
- CHALLENGE: 直面した課題、困難
- LEARNING: 学んだこと、気づき
- VALUE: 大切にしている価値観
- EMOTION: 感じた感情、モチベーション
- FACT: 事実情報（学歴、職歴など）
- SKILL_USAGE: スキルの使用例

各Fragmentには関連するスキルとキーワードも抽出してください。
JSON形式で返してください。`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: conversationHistory },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content || "{}";
  return JSON.parse(content);
}

export async function generateAgentSystemPrompt(
  fragments: { type: string; content: string }[],
  userName: string,
): Promise<string> {
  const fragmentsSummary = fragments
    .map((f) => `[${f.type}]: ${f.content}`)
    .join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
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

  return response.choices[0]?.message?.content || "";
}

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

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    temperature: 0.4,
    max_tokens: 1000,
    messages: [
      {
        role: "system",
        content:
          "あなたは採用面接の設計者です。求人と候補者情報に基づき、面接で聞くべき質問テンプレと不足情報を整理してください。",
      },
      {
        role: "user",
        content: `以下の情報をもとにJSONで回答してください。

## 求人情報
${jobContext}

## 候補者情報（要約）
${input.candidateSummary}

## 不足情報のヒント
${input.missingInfoHints.length > 0 ? input.missingInfoHints.join("\n") : "特になし"}

以下の形式でJSONを返してください:
{
  "questions": ["質問テンプレ1", "質問テンプレ2", ...],
  "missingInfo": ["不足情報1", "不足情報2", ...],
  "focusAreas": ["重点観点1", "重点観点2", ...]
}
`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content || "{}";
  try {
    const parsed = JSON.parse(content);
    return {
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
      missingInfo: Array.isArray(parsed.missingInfo) ? parsed.missingInfo : [],
      focusAreas: Array.isArray(parsed.focusAreas) ? parsed.focusAreas : [],
    };
  } catch {
    return {
      questions: [],
      missingInfo: [],
      focusAreas: [],
    };
  }
}

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
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    temperature: 0.4,
    max_tokens: 400,
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
${input.answer}

以下の形式でJSONを返してください:
{
  "followUps": ["追加質問1", "追加質問2", ...]
}
`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content || "{}";
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed.followUps) ? parsed.followUps : [];
  } catch {
    return [];
  }
}
