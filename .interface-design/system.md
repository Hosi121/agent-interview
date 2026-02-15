# Metalk Design System

## Direction

**藍 — フォーマルな格式と人間的な温もり**

AIエージェントが求職者を代理する採用プラットフォーム。
藍（インディゴ）をアンカーに、重みのあるプロフェッショナリズムと温かみのあるニュートラルを組み合わせる。
堅苦しさではなく、落ち着いた権威。

## Signature

**エージェントカード** — AIが実在の人物を代理する「生きた名刺」。
各カードがデータ行ではなく「人」に感じられること。

## Depth

**Borders-only** — 重要な判断のためのツール。影ではなくボーダーで構造を伝える。
ボーダーは低い不透明度で、見つけたときだけ見えるレベル。

## Colors

### Primitives

| Token | Light | Dark | Intent |
|---|---|---|---|
| `--primary` | oklch(0.45 0.16 250) | oklch(0.72 0.12 250) | 藍 — 深い権威 |
| `--primary-foreground` | oklch(1 0 0) | oklch(0.15 0 0) | Primary上のテキスト |
| `--background` | oklch(0.993 0.003 75) | oklch(0.15 0.005 260) | 温かみのある白/深い藍黒 |
| `--foreground` | oklch(0.15 0.005 250) | oklch(0.985 0.003 75) | 藍を帯びた墨/温かい白 |
| `--card` | oklch(1 0 0) | oklch(0.20 0.005 260) | 白/ダークサーフェス |
| `--secondary` | oklch(0.965 0.003 75) | oklch(0.27 0.005 260) | 温かいグレー |
| `--muted` | oklch(0.965 0.003 75) | oklch(0.27 0.005 260) | 温かいグレー |
| `--muted-foreground` | oklch(0.50 0.005 75) | oklch(0.65 0.01 75) | セカンダリテキスト |
| `--accent` | oklch(0.955 0.008 250) | oklch(0.27 0.01 260) | 藍のほのかなアクセント |
| `--border` | oklch(0.915 0.003 75) | oklch(1 0 0 / 10%) | 温かいボーダー |
| `--ring` | oklch(0.45 0.16 250) | oklch(0.72 0.12 250) | フォーカスリング = primary |
| `--destructive` | oklch(0.577 0.245 27.325) | oklch(0.704 0.191 22.216) | エラー/警告 |

### Semantic

- **Success:** oklch(0.55 0.15 155) — 控えめな緑
- **Warning:** oklch(0.75 0.15 75) — 琥珀
- **Info:** primary を使用

## Typography

- **Sans:** Geist — 正確で自信に満ちた書体。藍の格式に合う
- **Mono:** Geist Mono — データ表示用
- **Hierarchy:** サイズだけでなく、ウェイトとletter-spacingで層を作る

## Spacing

- **Base:** 4px
- **Scale:** 4, 8, 12, 16, 24, 32, 48, 64
- **Component padding:** 12px–16px（コンテキストに応じて密度を決定）
- **Section gap:** 24px–32px

## Border Radius

- **Base:** 0.625rem (10px)
- **Scale:** 6px (sm), 8px (md), 10px (lg), 14px (xl)
- 技術的すぎず、フレンドリーすぎない中間

## Patterns

### Agent Card (Signature)
- ボーダー: 1px, `--border`
- パディング: 16px
- Radius: lg (10px)
- アバター: 存在感のあるサイズ（48px+）
- ホバー: ボーダーカラーが `--primary` に近づく

### Button
- Height: 36px (default), 32px (sm)
- Padding: 12px 16px
- Radius: md (8px)
- Primary: `--primary` bg, weight のある存在感

### Input
- Height: 36px
- Padding: 8px 12px
- Border: 1px `--border`
- Focus: `--ring` (= primary)

### Chat Bubble
- Assistant (AI代理): 左寄せ、`--secondary` bg、アバター表示で「誰かとして語る」を視覚化
- User: 右寄せ、`--primary` bg
