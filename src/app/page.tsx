import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// 各カードに固有のアクセント色（OKLCH hue）を割り当て
const sampleCards = [
  {
    name: "Yuki Tanaka",
    initial: "Y",
    skills: ["React", "TypeScript", "Next.js", "AWS"],
    hue: 250, // 藍 — フロントエンドの信頼感
  },
  {
    name: "Haruto Sato",
    initial: "H",
    skills: ["Python", "Machine Learning", "PyTorch"],
    hue: 185, // ティール — データの流動性
  },
  {
    name: "Sakura Ito",
    initial: "S",
    skills: ["Figma", "UI/UX", "Design System"],
    hue: 350, // ローズ — クリエイティブの温かみ
  },
  {
    name: "Ren Yamamoto",
    initial: "R",
    skills: ["Go", "Kubernetes", "Terraform", "GCP"],
    hue: 155, // グリーン — インフラの安定
  },
  {
    name: "Aoi Nakamura",
    initial: "A",
    skills: ["Swift", "iOS", "Kotlin", "Android"],
    hue: 75, // アンバー — モバイルの活力
  },
  {
    name: "Kaito Watanabe",
    initial: "K",
    skills: ["Ruby", "Rails", "PostgreSQL"],
    hue: 25, // ルビー — Rubyの赤
  },
  {
    name: "Mio Suzuki",
    initial: "M",
    skills: ["Java", "Spring Boot", "Microservices"],
    hue: 290, // パープル — エンタープライズの重厚感
  },
  {
    name: "Sora Kimura",
    initial: "S",
    skills: ["Vue.js", "Nuxt", "GraphQL", "Node.js"],
    hue: 165, // エメラルド — Vueのグリーン
  },
];

// ヒーロー用の代表カード
const heroCard = {
  name: "Yuki Tanaka",
  title: "Frontend Engineer",
  initial: "Y",
  skills: ["React", "TypeScript", "Next.js", "AWS"],
  hue: 250,
};

function MarqueeCard({
  name,
  initial,
  skills,
  hue,
}: {
  name: string;
  initial: string;
  skills: string[];
  hue: number;
}) {
  return (
    <div className="relative w-[280px] shrink-0 aspect-[1.75/1] rounded-xl border bg-card p-5 flex flex-col justify-between overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.02)]">
      {/* 個性的なアクセントライン */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: `linear-gradient(to right, oklch(0.55 0.14 ${hue} / 0.5), oklch(0.50 0.16 ${hue}), oklch(0.55 0.14 ${hue} / 0.5))`,
        }}
      />
      <div className="flex items-start justify-between">
        <div className="space-y-0.5">
          <p className="text-[9px] tracking-widest text-muted-foreground uppercase">
            Agent
          </p>
          <p className="text-base font-bold tracking-tight text-foreground">
            {name}
          </p>
        </div>
        <div
          className="size-10 rounded-full flex items-center justify-center ring-2 ring-border"
          style={{
            backgroundColor: `oklch(0.95 0.03 ${hue})`,
          }}
        >
          <span
            className="text-sm font-semibold"
            style={{ color: `oklch(0.45 0.16 ${hue})` }}
          >
            {initial}
          </span>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-1">
          {skills.map((skill) => (
            <span
              key={skill}
              className="text-[9px] px-1.5 py-0.5 rounded-md text-muted-foreground"
              style={{
                backgroundColor: `oklch(0.96 0.01 ${hue})`,
              }}
            >
              {skill}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span
            className="text-[9px] font-medium"
            style={{ color: `oklch(0.50 0.14 ${hue})` }}
          >
            Public
          </span>
          <span className="text-[9px] tracking-widest text-muted-foreground/40 font-medium">
            MeTalk
          </span>
        </div>
      </div>
    </div>
  );
}

function HeroCard() {
  const { name, title, initial, skills, hue } = heroCard;
  return (
    <div
      className="relative w-full max-w-[440px] aspect-[1.75/1] rounded-2xl border bg-card p-8 flex flex-col justify-between overflow-hidden"
      style={{
        boxShadow:
          "0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.02)",
      }}
    >
      {/* 藍のアクセントライン */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: `linear-gradient(to right, oklch(0.55 0.14 ${hue} / 0.5), oklch(0.45 0.16 ${hue}), oklch(0.55 0.14 ${hue} / 0.5))`,
        }}
      />
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs tracking-widest text-muted-foreground uppercase">
            Agent
          </p>
          <p className="text-xl font-bold tracking-tight text-foreground">
            {name}
          </p>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
        <div
          className="size-14 rounded-full flex items-center justify-center ring-2 ring-border"
          style={{
            backgroundColor: `oklch(0.95 0.03 ${hue})`,
          }}
        >
          <span
            className="text-lg font-semibold"
            style={{ color: `oklch(0.45 0.16 ${hue})` }}
          >
            {initial}
          </span>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {skills.map((skill) => (
            <span
              key={skill}
              className="text-xs px-2.5 py-1 rounded-md text-muted-foreground"
              style={{
                backgroundColor: `oklch(0.96 0.01 ${hue})`,
              }}
            >
              {skill}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span
            className="text-xs font-medium"
            style={{ color: `oklch(0.50 0.14 ${hue})` }}
          >
            Public
          </span>
          <span className="text-xs tracking-widest text-muted-foreground/40 font-medium">
            MeTalk
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  // カードを2セット用意（シームレスなループ用）
  const cards = [...sampleCards, ...sampleCards];

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/"
            aria-label="MeTalk"
            className="inline-flex items-center"
          >
            <Image
              src="/logos/symbol+type.svg"
              alt="MeTalk"
              width={124}
              height={34}
              className="h-9 w-auto"
              priority
            />
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                ログイン
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm">無料で始める</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero — テキスト + 代表名刺 */}
        <section className="pt-20 pb-12 px-4">
          <div className="container mx-auto max-w-5xl">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <p className="text-xs tracking-widest text-primary uppercase mb-4">
                  AI Agent Platform
                </p>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.1] mb-6">
                  あなたの代わりに
                  <br />
                  <span className="text-primary">語る名刺</span>を。
                </h1>
                <p className="text-base text-muted-foreground mb-8 max-w-lg leading-relaxed">
                  AIと対話してパーソナルエージェントを作成。
                  あなたの経験とスキルを宿した名刺が、
                  採用担当者といつでも対話します。
                </p>
                <div className="flex gap-3">
                  <Link href="/register?tab=user">
                    <Button className="px-6">名刺を作る</Button>
                  </Link>
                  <Link href="/register?tab=recruiter">
                    <Button variant="outline" className="px-6">
                      採用担当者の方
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="flex justify-center md:justify-end">
                <div
                  style={{
                    perspective: "800px",
                    animation: "card-float 6s ease-in-out infinite",
                  }}
                >
                  <div
                    style={{
                      animation: "card-rotate 8s ease-in-out infinite",
                      transformStyle: "preserve-3d",
                    }}
                  >
                    <HeroCard />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Card marquee band */}
        <section className="py-12 overflow-hidden">
          <div className="relative" style={{ perspective: "1200px" }}>
            {/* 左右のフェード */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-32 z-10 bg-gradient-to-r from-background to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-32 z-10 bg-gradient-to-l from-background to-transparent" />

            {/* マーキートラック */}
            <div
              className="flex gap-5"
              style={{
                animation: "marquee-scroll 40s linear infinite",
                width: "max-content",
                transform: "rotateX(2deg)",
              }}
            >
              {cards.map((card, i) => (
                <MarqueeCard
                  key={`${card.name}-${i}`}
                  name={card.name}
                  initial={card.initial}
                  skills={card.skills}
                  hue={card.hue}
                />
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-20 border-t">
          <div className="container mx-auto px-4 max-w-4xl">
            <p className="text-xs tracking-widest text-primary uppercase mb-3 text-center">
              How it works
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-center mb-16">
              3ステップで、あなたの名刺が動き出す
            </h2>

            <div className="grid md:grid-cols-3 gap-12">
              <div className="text-center">
                <div className="size-10 mx-auto mb-4 rounded-lg bg-primary/10 flex items-center justify-center">
                  <svg
                    className="size-5 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <p className="text-sm font-semibold mb-1">AIと対話する</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  自然な会話であなたの経験やスキルをAIに伝える。
                  記憶のかけらとして蓄積されます。
                </p>
              </div>
              <div className="text-center">
                <div className="size-10 mx-auto mb-4 rounded-lg bg-primary/10 flex items-center justify-center">
                  <svg
                    className="size-5 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <p className="text-sm font-semibold mb-1">名刺を仕上げる</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  履歴書やポートフォリオを加えて、
                  あなたを完全に代理するエージェントへ。
                </p>
              </div>
              <div className="text-center">
                <div className="size-10 mx-auto mb-4 rounded-lg bg-primary/10 flex items-center justify-center">
                  <svg
                    className="size-5 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <p className="text-sm font-semibold mb-1">面接が始まる</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  採用担当者がいつでもあなたの名刺と対話。
                  時間と場所の制約を超えて。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* For both sides */}
        <section className="py-20 bg-secondary/50 border-t">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="grid md:grid-cols-2 gap-16">
              <div>
                <p className="text-xs tracking-widest text-primary uppercase mb-3">
                  For Job Seekers
                </p>
                <h3 className="text-lg font-bold tracking-tight mb-4">
                  求職者の方
                </h3>
                <div className="space-y-4">
                  {[
                    {
                      step: "1",
                      title: "アカウント作成",
                      desc: "Googleアカウントで簡単に登録",
                    },
                    {
                      step: "2",
                      title: "AIと対話 + ドキュメント投稿",
                      desc: "あなたの経験とスキルを伝える",
                    },
                    {
                      step: "3",
                      title: "名刺を公開",
                      desc: "採用担当者からの面接を待つ",
                    },
                  ].map((item) => (
                    <div key={item.step} className="flex gap-3">
                      <span className="shrink-0 size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold tabular-nums">
                        {item.step}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs tracking-widest text-primary uppercase mb-3">
                  For Recruiters
                </p>
                <h3 className="text-lg font-bold tracking-tight mb-4">
                  採用担当者の方
                </h3>
                <div className="space-y-4">
                  {[
                    {
                      step: "1",
                      title: "アカウント作成",
                      desc: "会社名を入力して登録",
                    },
                    {
                      step: "2",
                      title: "名刺一覧を閲覧",
                      desc: "公開されているエージェントを探す",
                    },
                    {
                      step: "3",
                      title: "エージェントと面接",
                      desc: "いつでも非同期で対話",
                    },
                  ].map((item) => (
                    <div key={item.step} className="flex gap-3">
                      <span className="shrink-0 size-6 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-semibold tabular-nums">
                        {item.step}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 border-t">
          <div className="container mx-auto px-4 text-center">
            <h3 className="text-xl font-bold tracking-tight mb-2">
              あなたの名刺を、今日から。
            </h3>
            <p className="text-sm text-muted-foreground mb-8">
              無料で登録して、新しい採用体験を始めましょう
            </p>
            <Link href="/register">
              <Button className="px-8">無料で始める</Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs text-muted-foreground">
            &copy; 2026 MeTalk. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
