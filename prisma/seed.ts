import { PrismaClient, AccountType, FragmentType, SourceType, AgentStatus } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await hash("password123", 12);

  // テスト求職者ユーザー
  const userAccount = await prisma.account.upsert({
    where: { email: "user@example.com" },
    update: {},
    create: {
      email: "user@example.com",
      passwordHash: password,
      accountType: AccountType.USER,
      user: {
        create: {
          name: "山田 太郎",
        },
      },
    },
    include: { user: true },
  });

  // テスト採用担当者ユーザー
  const recruiterAccount = await prisma.account.upsert({
    where: { email: "recruiter@example.com" },
    update: {},
    create: {
      email: "recruiter@example.com",
      passwordHash: password,
      accountType: AccountType.RECRUITER,
      recruiter: {
        create: {
          companyName: "株式会社テスト",
        },
      },
    },
  });

  if (userAccount.user) {
    const userId = userAccount.user.id;

    // 記憶のかけらを作成
    const fragments = [
      {
        type: FragmentType.FACT,
        content: "東京大学工学部情報工学科を2018年に卒業",
        skills: ["コンピュータサイエンス"],
        keywords: ["東京大学", "情報工学", "学士"],
      },
      {
        type: FragmentType.FACT,
        content: "株式会社テックコーポレーションでバックエンドエンジニアとして3年間勤務",
        skills: ["バックエンド開発"],
        keywords: ["エンジニア", "3年", "正社員"],
      },
      {
        type: FragmentType.SKILL_USAGE,
        content: "TypeScript、React、Node.jsを使用したWebアプリケーション開発を担当",
        skills: ["TypeScript", "React", "Node.js", "Web開発"],
        keywords: ["フロントエンド", "バックエンド", "フルスタック"],
      },
      {
        type: FragmentType.ACHIEVEMENT,
        content: "社内の決済システムのリアーキテクチャを主導し、レスポンス時間を50%改善",
        skills: ["システム設計", "パフォーマンス最適化"],
        keywords: ["決済システム", "リアーキテクチャ", "改善"],
      },
      {
        type: FragmentType.ACHIEVEMENT,
        content: "新人研修プログラムを設計・実施し、オンボーディング期間を2週間短縮",
        skills: ["メンタリング", "研修設計"],
        keywords: ["新人研修", "オンボーディング", "教育"],
      },
      {
        type: FragmentType.CHALLENGE,
        content: "レガシーシステムからの移行プロジェクトで、データ整合性を保ちながら段階的な移行を実現",
        skills: ["プロジェクト管理", "データマイグレーション"],
        keywords: ["レガシー", "移行", "段階的"],
      },
      {
        type: FragmentType.LEARNING,
        content: "AWSの各種サービス（EC2, Lambda, RDS, S3）を実務で習得",
        skills: ["AWS", "クラウドインフラ"],
        keywords: ["AWS", "クラウド", "インフラ"],
      },
      {
        type: FragmentType.VALUE,
        content: "チームでの協働を大切にし、コードレビューを通じた知識共有を積極的に行う",
        skills: ["チームワーク", "コードレビュー"],
        keywords: ["協働", "知識共有", "チーム"],
      },
    ];

    for (const fragment of fragments) {
      await prisma.fragment.upsert({
        where: {
          id: `seed-fragment-${fragment.content.slice(0, 20)}`,
        },
        update: {},
        create: {
          userId,
          type: fragment.type,
          content: fragment.content,
          skills: fragment.skills,
          keywords: fragment.keywords,
          sourceType: SourceType.CONVERSATION,
          confidence: 1.0,
        },
      });
    }

    // エージェントを作成
    await prisma.agentProfile.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        systemPrompt: `あなたは山田太郎さんを代理するAIエージェントです。

## 基本情報
- 名前: 山田 太郎
- 職種: バックエンドエンジニア / フルスタックエンジニア
- 経験年数: 約5年

## 経歴
- 東京大学工学部情報工学科卒業（2018年）
- 株式会社テックコーポレーションでバックエンドエンジニアとして3年間勤務

## 技術スキル
- 言語: TypeScript, JavaScript, Python
- フレームワーク: React, Node.js, Next.js
- インフラ: AWS (EC2, Lambda, RDS, S3)
- その他: Git, Docker, CI/CD

## 主な実績
- 決済システムのリアーキテクチャを主導し、レスポンス時間を50%改善
- 新人研修プログラムを設計・実施し、オンボーディング期間を2週間短縮
- レガシーシステムからの段階的移行を成功させた

## 性格・価値観
- チームでの協働を大切にする
- コードレビューを通じた知識共有を積極的に行う
- 技術的な課題に対して粘り強く取り組む

採用担当者からの質問に対して、上記の情報を元に山田太郎さんとして丁寧に回答してください。
わからないことは正直に「その点についてはまだ情報を持っていません」と答えてください。`,
        status: AgentStatus.PUBLIC,
      },
    });

    console.log("Created test data:");
    console.log("- User: user@example.com / password123");
    console.log("  - 8 fragments (記憶のかけら)");
    console.log("  - 1 public agent");
    console.log("- Recruiter: recruiter@example.com / password123");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
