# Immersive Poetry Page｜沉浸式古诗词网页生成 Skill

把一首中国古典诗、词、曲或古风散文诗，制作成一个真正可运行的电影感滚动网页。

[![Website](https://img.shields.io/badge/Website-zlbigger.com-C9955A?style=for-the-badge)](https://zlbigger.com)
[![Codex Skill](https://img.shields.io/badge/Codex-Skill-111827?style=for-the-badge)](https://zlbigger.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-2F855A?style=for-the-badge)](LICENSE)

`immersive-poetry-page` 是一个面向 Codex 的创作型 Skill。它不只生成一张网页草图，而是完成从文学分析、视觉分镜、AI 图像生成、前端实现到浏览器验收的完整生产流程。

项目主页：[https://zlbigger.com](https://zlbigger.com)

## 它能做什么

给它一首诗，例如：

```text
使用 $immersive-poetry-page，把李白《将进酒》制作成沉浸式页面。
```

Skill 会依次完成：

1. 检查现有前端项目、构建脚本、路由和未提交文件。
2. 核对作品信息、原文与重要文本异文。
3. 按叙事和情绪转折拆分为 5–8 个视觉段落。
4. 建立统一的时代、地理、人物、服饰、色彩和镜头语言。
5. 通过内置 ImageGen 为主视觉和每个重要段落分别生成图片。
6. 制作联系表，检查人物一致性、时代错误、意外文字和风格漂移。
7. 构建带背景交叉淡入、轻微视差和章节导航的响应式网页。
8. 接入诗词朗诵，尝试自动播放，并提供始终可用的播放／暂停开关。
9. 增加逐段直译、细读、技法说明和全诗情绪结构。
10. 运行生产构建，并在真实浏览器中检查桌面、移动端、音频和控制台。

## 核心特点

### 1. 文学分镜，而不是平均切句

分段依据空间、时间、视角、人物、动作、修辞模式和情绪方向的变化。相互依赖的诗句共用同一场景，避免“每一句配一张无关古风图”的碎片化效果。

每个视觉段落都需要明确：

- 原文
- 现代直义
- 可见意象与动作
- 关键写作手法
- 在全诗中的情绪功能
- 可拍摄、符合时代背景的场景
- 页面文案所需的留白方向

### 2. 一套贯穿全页的视觉圣经

所有生成图共享同一套约束：

- 朝代与地理环境
- 重复人物的年龄、脸型、发式、服装和道具
- 建筑、器物和材质
- 4–6 个核心色彩
- 随诗意推进的光线和天气
- 镜头焦段、构图和色彩科学
- 明确的禁止项

画面优先采用写实历史电影、真实微缩摄影、摄影风景或克制的绘画电影感。默认避免卡通、塑料玩具、低多边形、通用游戏美术和空泛的“古风”。

### 3. 图片是叙事主体

页面使用固定图片舞台和两层图像交叉淡入。每个段落进入视口时，背景切换到对应场景，并只添加克制的缩放或指针视差。

桌面端让文案卡片保持在半屏以内；移动端采用 `contain` 主图配合模糊的全屏背景，尽量保留完整人物和关键构图。

### 4. 原文、解读和视觉同步

页面不仅展示原诗，还包括：

- 清晰的逐段直译
- 对关键词和动词节奏的解释
- 对照、时间线、情绪刻度等微型视觉组件
- 体式、意象系统、结构、修辞和核心张力总结
- 重要文本异文说明

原诗文字由 HTML 排版，生成图片中禁止出现书法、印章、签名、水印或错误文字。

### 5. 完整工程验收

交付前必须检查：

- 生产构建是否成功
- 首屏加载层是否正常消失
- 中段背景是否真实切换
- 卡片是否遮挡主体或裁切文字
- 结尾解读是否完整
- 手机端是否溢出或破坏构图
- `prefers-reduced-motion` 是否生效
- 浏览器控制台是否干净

### 6. 自动播放与朗读开关

每个页面可以配置一条朗诵音频。页面会尝试自动播放；如果浏览器拦截有声自动播放，则保持“朗读”按钮可见，用户点击后立即播放。按钮同步显示播放、暂停、重播和音频不可用状态，并提供 `aria-pressed` 与键盘焦点样式。

## 工作流

```mermaid
flowchart LR
    A[输入诗词] --> B[检查项目]
    B --> C[核对文本与文学分镜]
    C --> D[建立视觉圣经]
    D --> E[逐张生成图像]
    E --> F[联系表与一致性检查]
    F --> G[实现滚动页面]
    G --> H[生产构建]
    H --> I[桌面与移动端浏览器 QA]
```

## 安装

### 方式一：克隆后复制

```bash
git clone https://github.com/zlbigger/immersive-poetry-page.git
mkdir -p ~/.codex/skills
cp -R immersive-poetry-page/skills/immersive-poetry-page ~/.codex/skills/
```

重新打开 Codex 后，可以通过 `$immersive-poetry-page` 显式调用。

### 方式二：使用软链接，便于更新

```bash
git clone https://github.com/zlbigger/immersive-poetry-page.git
mkdir -p ~/.codex/skills
ln -s "$(pwd)/immersive-poetry-page/skills/immersive-poetry-page" \
  ~/.codex/skills/immersive-poetry-page
```

后续更新：

```bash
cd immersive-poetry-page
git pull
```

## 使用示例

### 创建一个新的诗词页面

```text
使用 $immersive-poetry-page，把苏轼《定风波·莫听穿林打叶声》制作成电影感沉浸式网页。
```

### 在已有 Vite 项目中增加页面

```text
使用 $immersive-poetry-page，在当前 Vite 多页面项目中新建《蜀道难》页面，保留已有诗词页面并互相添加导航。
```

### 强调教育解读

```text
使用 $immersive-poetry-page，把《琵琶行》做成适合高中生阅读的沉浸式页面，解释关键动词、音乐描写和情绪转折。
```

### 指定视觉方向

```text
使用 $immersive-poetry-page，把王维《山居秋暝》制作成留白克制的摄影风景页面，不要仙侠感。
```

## 推荐输入

最简单的输入只需要作品名。若希望更精确，可以补充：

- 使用的原文版本
- 目标读者
- 当前项目路径或框架
- 希望的视觉媒介
- 是否需要拼音、注释或课堂讲解
- 是否需要与已有诗词页互相导航
- 已有朗诵音频的公开 URL 或项目内路径

没有指定时，Skill 会检查项目并作出保守、可解释的默认选择。

## 仓库结构

```text
immersive-poetry-page/
├── README.md
├── LICENSE
└── skills/
    └── immersive-poetry-page/
        ├── SKILL.md
        ├── agents/
        │   └── openai.yaml
        ├── references/
        │   ├── poetry-analysis.md
        │   ├── image-direction.md
        │   └── page-pattern.md
        ├── assets/
        │   └── page-template/
        └── scripts/
            └── extract_imagegen_results.py
```

## 内置资源

### `references/poetry-analysis.md`

规定如何保护原文、判断分镜边界、解释关键词，以及如何总结体式、意象、运动和核心张力。

### `references/image-direction.md`

提供视觉圣经、主视觉提示词、段落提示词和一致性检查标准。

### `references/page-pattern.md`

描述推荐的页面结构、固定图片舞台、交叉淡入、章节选择、响应式策略和 QA 清单。

### `assets/page-template/`

一个轻量 Vite/TypeScript/CSS 页面模板。当前项目没有更强设计系统时，可以以它为起点。

### `scripts/extract_imagegen_results.py`

当内置 ImageGen 结果没有直接落入预期目录时，从 Codex rollout JSONL 中提取最近的生成图片：

```bash
python skills/immersive-poetry-page/scripts/extract_imagegen_results.py \
  --session /path/to/rollout.jsonl \
  --count 7 \
  --out-dir public/generated/poem-name \
  --names hero,scene-1,scene-2,scene-3,scene-4,scene-5,scene-6
```

`--count` 必须与 `--names` 的名称数量一致。

## 环境与依赖

- Codex，且能够发现本地 Skills
- 内置 ImageGen，用于生成页面视觉素材
- 一个可运行的前端项目；Vite + TypeScript 是默认模板，但 Skill 会优先复用当前技术栈
- 每首诗的朗诵音频文件或可公开访问的音频 URL
- 可用的生产构建命令
- 可进行页面检查的真实浏览器环境
- Python 3，仅在需要运行图片提取脚本时使用

## 设计原则

- 图像必须服务于诗的情绪世界，而不是装饰背景。
- 保留用户提供的原文，不静默“纠正”文本。
- 有意义的异文要说明，但不打断阅读体验。
- 一个重要段落对应一张独立生成图，避免用一个通用提示词批量制造相似图片。
- 主视觉确定世界观，后续图像必须显式继承人物、地理、服装、材质、天气和镜头语言。
- 不覆盖已有诗词页面；新增独立入口并建立页面导航。
- 不把未经联系表检查的生成图片接入网页。
- 不把 PNG 母版直接作为全部线上资源，优先使用压缩后的 JPEG/WebP/AVIF。
- 不依赖自动播放作为唯一入口；浏览器拦截时必须保留可访问的朗读开关。

## 常见问题

### 为什么不直接让模型生成一个网页？

高质量诗词页面的难点不是单次写 HTML，而是让文本版本、文学解释、图像世界、滚动节奏和移动端构图彼此一致。该 Skill 把这些容易遗漏的检查固化成工作流。

### 为什么要逐张生成图片？

每个场景需要不同的动作、构图、光线和留白方向。单个提示词同时生成多幕画面，会降低可控性，也更容易产生人物漂移。

### 为什么要保存 PNG 和压缩版本？

PNG 便于后续修复和重新导出；网页则应引用体积更小的 JPEG、WebP 或 AVIF，以减少加载时间。

### 可以用于现代诗吗？

可以尝试，但当前分析规则、体式说明和视觉方向主要针对中国古典诗、词、曲和古风长诗。

### 会覆盖已有页面吗？

不会。Skill 明确要求新建路由或独立 HTML 入口，并在多页面项目中补充导航。

## 贡献

欢迎提交 Issue 或 Pull Request，改进文学分析规则、视觉一致性检查、页面模板和浏览器 QA 流程。

更多作品与项目介绍请访问：[https://zlbigger.com](https://zlbigger.com)

## License

[MIT License](LICENSE) © 2026 zlbigger
