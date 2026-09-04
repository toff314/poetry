---
version: "1.0"
name: PoetryRealm-design-system
description: |
  诗境 (Poetry Realm) 是一个以 AI 生成沉浸式中国古典诗词网页为核心的内容平台。设计系统参考 Runway 的电影感暗色视觉语言与 Apple 的精致留白，将每一首诗词当作一部电影来对待：全幅画面是场景，文字是旁白，滚动是镜头运动。整体以浓墨黑、宣纸白、朱砂红、金箔黄构建中式色彩身份，中文正文使用 Noto Serif SC 营造书卷气，UI 文字使用 Inter/Noto Sans SC 保持现代阅读效率。
---

# 诗境 Poetry Realm — Design System

## 1. Visual Theme & Atmosphere

诗境的界面像一部缓缓展开的水墨长卷。黑色是底，金色与朱砂是点睛，白色文字是题跋。我们不把诗词当成数据库条目，而是把每一首都处理成一次独立的沉浸式阅读事件：

- **首页**：巨幅诗词英雄区，随机一首诗词如电影海报占据首屏；下方是精选诗词卡片网格。
- **诗词库**：高密度但不拥挤的目录，支持搜索、朝代筛选、诗人筛选。
- **诗词详情**：电影感滚动页面，固定背景舞台、交叉淡入、逐段解读卡片。

整体气质是**克制的东方电影感**：不仙侠、不卡通、不高饱和。视觉内容由 AI 生成图或精选氛围图承担，UI 退后成为 invisible frame。

## 2. Color Palette & Roles

### Primary
- **墨黑** `#0a0a0b`: 页面主背景、英雄区底色、详情页舞台底色。
- **玄青** `#141516`: 卡片表面、次级深色容器、导航hover底。
- **宣纸** `#f4f1ea`: 浅色区块背景、详情页文案卡片底色（半透明）。
- **纯白** `#ffffff`: 深色背景上的主文字、按钮文字。

### Accent
- **金箔** `#c9a227`: 品牌强调色——CTA、高亮诗句、标签、focus ring。象征诗词中的高光时刻。
- **朱砂** `#c45c3e`: 情感强调——删除、危险、极少数强情感标签。
- **青黛** `#2a5a6b`: 辅助强调——链接、信息提示、诗人朝代标签。

### Neutrals & Text
- **炭黑** `#1a1a1a`: 浅色背景上的主标题。
- **墨灰** `#404040`: 浅色背景正文。
- **石灰** `#6b6b6b`: 次级文字、metadata。
- **银灰** `#9a9a9a`: 占位符、禁用态、脚注。
- **暗银** `#767d88`: 深色背景上次级文字。
- **浅银** `#c9ccd1`: 浅色背景分割线。
- **深分割线** `#27272a`: 深色背景分割线、卡片边框。

### Gradient System
界面本身不使用装饰渐变。所有色彩层次由摄影作品/AI 生成图提供。仅允许在图片 overlay 中使用从透明到墨黑的线性渐变以保证文字可读性。

## 3. Typography Rules

### Font Family
- **中文诗词与标题**：`"Noto Serif SC", "Songti SC", "SimSun", serif` —— 书卷气与庄重感。
- **UI / 正文 / 标签**：`Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif` —— 现代、清晰、高信息密度。
- **代码 / 数据标签**：`"JetBrains Mono", ui-monospace, monospace` —— 仅用于脚本提示、技术metadata。

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Use |
|------|------|------|--------|-------------|----------------|-----|
| Hero Title | Noto Serif SC | 56px (3.5rem) | 500 | 1.10 | 0.02em | 首页英雄区诗词标题 |
| Section Title | Noto Serif SC | 40px (2.5rem) | 500 | 1.20 | 0.01em | 页面大标题 |
| Page Title | Noto Serif SC | 32px (2rem) | 500 | 1.25 | 0.01em | 诗词详情首屏标题 |
| Card Title | Noto Serif SC | 24px (1.5rem) | 500 | 1.35 | 0.01em | 诗词卡片标题 |
| Poem Line | Noto Serif SC | 28px (1.75rem) | 400 | 1.60 | 0.04em | 详情页原诗行 |
| UI Heading | Inter | 22px (1.375rem) | 600 | 1.30 | -0.01em | 面板标题 |
| Body | Inter/Noto Sans SC | 16px (1rem) | 400 | 1.60 | 0 | 正文、列表 |
| Body Large | Inter/Noto Sans SC | 18px (1.125rem) | 400 | 1.70 | 0 | 引言、描述 |
| Caption | Inter | 13px (0.8125rem) | 500 | 1.40 | 0.02em | metadata、小标签 |
| Label | Inter | 12px (0.75rem) | 500 | 1.30 | 0.08em | 大写/中英标签 |

### Principles
- 诗词文字永远用 Noto Serif SC，行高 1.6，字距稍宽（0.04em），给方块字呼吸空间。
- UI 文字用 Inter/Noto Sans SC，行高 1.6，适应中文长文阅读。
- 标题不过度 bold，中文书法感来自 serif + weight 500，不是 700/800。
- 标签使用大写英文字距或中文小字间距，与诗词正文形成材质对比。

## 4. Component Stylings

### Buttons
- **Primary CTA**：背景 `#c9a227`，文字 `#0a0a0b`，圆角 8px，padding 10px 20px，weight 500。
- **Secondary**：透明背景，边框 1px `#c9a227`/30%，文字 `#c9a227`，圆角 8px。
- **Ghost**：透明背景，文字 `#f4f1ea`/`#1a1a1a`，hover 时 opacity 0.8。
- **On Dark**：深色背景上用 `#f4f1ea` 文字、透明或细边框按钮。

### Cards & Containers
- **诗词卡片**：背景 `#141516`，圆角 12px，无阴影，1px 边框 `#27272a`；hover 时边框变为 `#c9a227`/40%。
- **详情文案卡片**：背景 `rgba(20, 21, 22, 0.78)`，backdrop-blur(14px)，边框 `rgba(255,255,255,0.12)`。
- **搜索面板**：背景 `#141516`，圆角 12px，1px 边框 `#27272a`。
- **零阴影原则**：所有深度来自背景色层级和摄影内容，不使用 box-shadow。

### Navigation
- 顶部导航：固定、透明或墨黑半透明背景，高度 64px。
- Logo："诗境" 二字使用 Noto Serif SC，旁配英文 POETRY REALM 小标。
- 链接：16px，weight 500，hover 时金色下划线或文字变金。
- 移动端：汉堡菜单，侧滑抽屉（墨黑背景）。

### Image Treatment
- 英雄图与详情背景：全出血、电影级构图、16:9 或更宽比例。
- 卡片缩略图：16:9 或 4:3，圆角 12px，object-fit cover。
- 图片上覆盖渐变：`linear-gradient(90deg, rgba(10,10,11,0.78), transparent 62%), linear-gradient(0deg, rgba(10,10,11,0.55), transparent 48%)`。

## 5. Layout Principles

### Spacing System
- Base unit: 4px
- Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128px
- Section vertical: 80–128px（首页大呼吸），48–64px（内容页紧凑）
- Content max-width: 1280px（管理/列表），详情页卡片 max-width 560px
- 诗词库网格：桌面 3 列，平板 2 列，手机 1 列

### Grid & Container
- 首页英雄区：全屏高度 100vh，内容左对齐或居中。
- 诗词库：sticky 搜索/筛选侧边栏 + 主内容区。
- 详情页：fixed 图片舞台 + 滚动文档流 section。

### Whitespace Philosophy
- 电影感呼吸：大垂直间距让每次滚动像切换镜头。
- 图片即留白：视觉内容承担大部分节奏功能。
- 中文信息密度：列表页紧凑，详情页宽裕。

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat | 无阴影、无边框 | 默认文本区块 |
| Hairline | 1px `#27272a` | 卡片、面板、分割线 |
| Elevated Surface | `#141516` 背景 + hairline | 卡片、抽屉、弹窗 |
| Overlay | 半透明墨黑 + blur | 详情文案卡片、导航下拉、加载层 |

## 7. Do's and Don'ts

### Do
- 用全出血电影感图片作为视觉主体。
- 用 Noto Serif SC 呈现诗词与标题。
- 用金箔色 `#c9a227` 作为唯一 chromatic accent。
- 保持零阴影，深度靠摄影和背景层级。
- 为每首诗词生成/准备 16:9 氛围图。
- 列表页支持搜索、朝代筛选、诗人筛选。
- 详情页采用固定背景舞台 + 滚动解读卡片。

### Don't
- 不用卡通、仙侠、塑料感 AI 图。
- 不用多 chromatic accent（只用金箔，必要时朱砂）。
- 不用渐变背景装饰。
- 不用 700+ weight 做标题。
- 不用 monospace 显示诗词正文。
- 不在图片上加文字/印章/书法（所有文字用 HTML 渲染）。
- 不覆盖已有诗词页面，新增独立入口。

## 8. Responsive Behavior

| Name | Width | Key Changes |
|------|-------|-------------|
| Mobile | <640px | 单列，导航抽屉，详情卡片全宽，英雄区标题 36px |
| Tablet | 640–1023px | 2 列卡片网格，详情卡片 80% 宽 |
| Desktop | 1024–1279px | 3 列网格，侧边栏出现 |
| Wide | ≥1280px | 完整布局，max-width 1280px 容器 |

## 9. Agent Prompt Guide

### Quick Color Reference
- 页面背景：墨黑 `#0a0a0b`
- 卡片/次级背景：玄青 `#141516`
- 浅色背景：宣纸 `#f4f1ea`
- 强调/CTA：金箔 `#c9a227`
- 深色文字：炭黑 `#1a1a1a`
- 深色上次级文字：暗银 `#767d88`
- 浅色上次级文字：石灰 `#6b6b6b`

### Example Prompts
- "Create a cinematic hero for the poetry site: full-bleed dark image overlay, Noto Serif SC title at 56px weight 500 in `#f4f1ea`, poet/era label in `#c9a227` 14px, scroll cue at bottom."
- "Design a poem card: `#141516` background, 12px radius, 1px `#27272a` border, hover border to `#c9a227`/40%. Image 16:9 top, title in Noto Serif SC 24px, dynasty tag in gold caption."
- "Build a poetry library page: sticky search bar, dynasty filter pills, 3-column poem grid. Use Inter for UI, Noto Serif SC for poem titles."
- "Create an immersive detail page: fixed background image stage, scroll-driven section transitions, translucent blur cards with original poem line, literal meaning, and close reading."
