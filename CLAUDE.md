# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Metalk — AIエージェントによる非同期型採用プラットフォーム。求職者がAIエージェントを作成し、採用担当者がそのエージェントと対話して候補者を評価する。ポイント課金制（会話1pt、メッセージ3pt、連絡先開示10pt）。

## Tech Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript 5
- **DB/ORM:** PostgreSQL 16 + Prisma 6
- **UI:** Radix UI + Tailwind CSS 4
- **Auth:** NextAuth.js 4 (JWT session, credentials provider)
- **外部サービス:** OpenAI API, MinIO (S3互換ストレージ), Stripe (課金)
- **Lint/Format:** Biome 2 (スペース2, ダブルクォート, セミコロンあり)
- **Test:** Vitest 4 + React Testing Library (jsdom)
- **Git Hooks:** Lefthook (pre-commit: biome check + tsc --noEmit)

## Commands

```bash
# AWS CLI
# 常に --profile metalk を付けること
aws s3 ls --profile metalk

# 開発
npm run dev                    # 開発サーバー起動
docker compose up -d           # DB/MinIO/Stripe mock起動

# コード品質
npm run check                  # Biome lint + format (auto-fix)
npm run lint                   # lint only
npx tsc --noEmit               # 型チェック

# テスト
npm run test                   # watch mode
npm run test:run               # 一回実行
npx vitest run src/lib/points.test.ts  # 単一ファイル実行

# データベース
npm run db:migrate             # マイグレーション作成・適用
npm run db:push                # スキーマ直接反映（マイグレーションファイルなし）
npm run db:generate            # Prisma Client再生成
npm run db:seed                # テストデータ投入
npm run db:studio              # Prisma Studio GUI
```

## Architecture

### ルーティングとロール分離

App Routerのルートグループで求職者と採用担当者を分離:
- `src/app/(applicant)/` — 求職者向けUI（ダッシュボード、受信箱、ドキュメント管理）
- `src/app/(auth)/` — ログイン・登録
- `src/app/recruiter/` — 採用担当者向けUI（求人管理、パイプライン、面談）
- `src/app/api/` — REST APIエンドポイント

### APIハンドラーパターン

`src/lib/api-utils.ts` にある認証ラッパーでAPIルートを構成する:
- `withRecruiterAuth` / `withRecruiterValidation` — 採用担当者認証 + Zodバリデーション
- `withUserAuth` / `withUserValidation` — 求職者認証 + Zodバリデーション
- `withAuth` / `withAuthValidation` — ロール不問の認証
- `withErrorHandling` / `withValidation` — 認証不要（エラーハンドリングのみ）

APIルートの典型的パターン:
```typescript
export const POST = withRecruiterValidation(schema, async (body, req, session) => {
  // session.user.recruiterId, session.user.companyId が型安全で利用可能
  return apiSuccess(result);
});
```

### エラーハンドリング

`src/lib/errors.ts` の `AppError` 継承クラスを使用。ラッパーが自動的にNextResponseに変換する:
- `ValidationError` (400), `UnauthorizedError` (401), `ForbiddenError` (403)
- `NotFoundError` (404), `ConflictError` (409)
- `InsufficientPointsError` (402), `NoSubscriptionError` (402)

### ポイント消費

`src/lib/points.ts` でポイント操作を管理。DB操作と合わせてトランザクション内で実行する場合は `consumePointsWithOperations` を使う。

### テストパターン

Prismaクライアントは `vi.hoisted` + `vi.mock("./prisma")` でモック化。`$transaction` はコールバックにモックPrismaを渡す形で実装。テストは `describe` / `it` で日本語記述。

### 主要ディレクトリ

- `src/lib/` — ビジネスロジック・ユーティリティ（auth, points, matching, errors, validations）
- `src/components/ui/` — Radix UIベースの共通UIコンポーネント
- `src/types/` — 共有型定義
- `prisma/schema.prisma` — 全データモデル定義
- `prisma/seed.ts` — シードデータ
- `docs/` — ビジネスモデル・設計ドキュメント

### パスエイリアス

`@/*` → `./src/*`（tsconfig.json + vitest.config.ts で設定済み）
