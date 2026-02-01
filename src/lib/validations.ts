import { z } from "zod";

// 共通スキーマ
export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// 認証関連
export const registerSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z
    .string()
    .min(6, "パスワードは6文字以上にしてください")
    .max(100, "パスワードは100文字以下にしてください"),
  name: z.string().min(1, "名前を入力してください").max(100),
  companyName: z.string().max(200).optional(),
  accountType: z.enum(["USER", "RECRUITER"]),
});

export const loginSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(1, "パスワードを入力してください"),
});

export const inviteCreateSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  role: z.enum(["ADMIN", "MEMBER"], {
    message: "権限を選択してください",
  }),
});

export const inviteAcceptSchema = z.object({
  password: z
    .string()
    .min(6, "パスワードは6文字以上にしてください")
    .max(100, "パスワードは100文字以下にしてください"),
});

export const inviteUpdateSchema = z.object({
  status: z.enum(["REVOKED"], {
    message: "無効なステータスです",
  }),
});

export const memberUpdateSchema = z.object({
  status: z.enum(["ACTIVE", "DISABLED"], {
    message: "無効なステータスです",
  }),
});

// 求人関連
export const experienceLevelSchema = z.enum([
  "ENTRY",
  "JUNIOR",
  "MID",
  "SENIOR",
  "LEAD",
]);

export const jobPostingSchema = z.object({
  title: z.string().min(1, "タイトルを入力してください").max(200),
  description: z.string().max(10000).optional(),
  skills: z.array(z.string().max(50)).max(20).default([]),
  keywords: z.array(z.string().max(50)).max(20).default([]),
  experienceLevel: experienceLevelSchema.default("MID"),
  salaryMin: z.number().int().min(0).optional(),
  salaryMax: z.number().int().min(0).optional(),
  location: z.string().max(100).optional(),
  remoteOk: z.boolean().default(false),
});

// ウォッチリスト関連
export const watchCreateSchema = z.object({
  name: z.string().min(1, "名前を入力してください").max(100),
  jobId: z.string().uuid().optional(),
  skills: z.array(z.string().max(50)).max(20).default([]),
  keywords: z.array(z.string().max(50)).max(20).default([]),
  experienceLevel: experienceLevelSchema.optional(),
  locationPref: z.string().max(100).optional(),
  salaryMin: z.number().int().min(0).optional(),
});

// パイプライン関連
export const pipelineStatusSchema = z.enum([
  "INTERESTED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
]);

export const pipelineCreateSchema = z.object({
  agentId: z.string().uuid(),
  jobId: z.string().uuid().optional(),
  status: pipelineStatusSchema.default("INTERESTED"),
  notes: z.string().max(5000).optional(),
});

export const pipelineUpdateSchema = z.object({
  status: pipelineStatusSchema.optional(),
  notes: z.string().max(5000).optional(),
});

// 興味表明関連
export const interestCreateSchema = z.object({
  agentId: z.string().uuid("無効なエージェントIDです"),
  message: z.string().max(1000).optional(),
});

// メッセージ関連
export const messageCreateSchema = z.object({
  content: z
    .string()
    .min(1, "メッセージを入力してください")
    .max(5000, "メッセージは5000文字以下にしてください"),
});

// 比較レポート関連
export const compareSchema = z.object({
  agentIds: z
    .array(z.string().uuid())
    .min(2, "2人以上の候補者を選択してください")
    .max(5, "5人まで比較できます"),
  criteria: z.string().max(1000).optional(),
});

// 評価関連
export const evaluationSchema = z.object({
  overallRating: z.number().int().min(1).max(5),
  technicalRating: z.number().int().min(1).max(5),
  communicationRating: z.number().int().min(1).max(5),
  cultureRating: z.number().int().min(1).max(5),
  comment: z.string().max(5000).optional(),
});

// ノート関連
export const noteCreateSchema = z.object({
  content: z
    .string()
    .min(1, "内容を入力してください")
    .max(5000, "内容は5000文字以下にしてください"),
});

// チャット関連
export const chatMessageSchema = z.object({
  message: z
    .string()
    .min(1, "メッセージを入力してください")
    .max(2000, "メッセージは2000文字以下にしてください"),
});

/**
 * リクエストボディをバリデート
 * @throws ZodError
 */
export async function validateBody<T>(
  req: Request,
  schema: z.ZodSchema<T>,
): Promise<T> {
  const body = await req.json();
  return schema.parse(body);
}

/**
 * バリデーションエラーをAPIエラーレスポンスに変換
 */
export function formatZodError(error: z.ZodError): {
  error: string;
  code: string;
  details: Record<string, string[]>;
} {
  const details: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (!details[path]) {
      details[path] = [];
    }
    details[path].push(issue.message);
  }

  return {
    error: "入力内容に問題があります",
    code: "VALIDATION_ERROR",
    details,
  };
}

// 型エクスポート
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type InviteCreateInput = z.infer<typeof inviteCreateSchema>;
export type InviteAcceptInput = z.infer<typeof inviteAcceptSchema>;
export type InviteUpdateInput = z.infer<typeof inviteUpdateSchema>;
export type MemberUpdateInput = z.infer<typeof memberUpdateSchema>;
export type JobPostingInput = z.infer<typeof jobPostingSchema>;
export type WatchCreateInput = z.infer<typeof watchCreateSchema>;
export type PipelineCreateInput = z.infer<typeof pipelineCreateSchema>;
export type PipelineUpdateInput = z.infer<typeof pipelineUpdateSchema>;
export type InterestCreateInput = z.infer<typeof interestCreateSchema>;
export type MessageCreateInput = z.infer<typeof messageCreateSchema>;
export type CompareInput = z.infer<typeof compareSchema>;
export type EvaluationInput = z.infer<typeof evaluationSchema>;
export type NoteCreateInput = z.infer<typeof noteCreateSchema>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
