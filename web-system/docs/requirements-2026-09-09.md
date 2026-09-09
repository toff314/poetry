# 需求文档 · 2026-09-09

## 需求：修复放映厅（/cinema）背景音乐无声 + BGM 时长探测重复请求

### 背景与问题

线上 https://poetry.askfount.com/cinema 放映厅进入后背景音乐永久无声。

1. **主问题**：`Theater`（src/pages/Cinema.tsx）的 `<audio>` 在 useEffect 中
   `au.play().catch(() => {})`。iOS Safari 等浏览器的自动播放策略会拒绝不在
   用户手势上下文内的 `play()` 调用；catch 吞掉错误后无任何重试机制。
   对照 `AmbientBgm` 组件（首次 pointerdown/keydown 手势重试）有声，
   放映厅无声，体验不一致。
2. **次问题**：`loadProgram` 对片单 10 部影片逐个 `probeDuration`，
   不按 `track.id` 去重——同一 track 最多被复用 2 次，导致同一音频被
   重复探测（实测最多 5 次），与主音频播放争抢网络带宽。

### 需求描述

1. Theater 首次 `play()` 被自动播放策略拒绝时，应在下一次用户手势
   （pointerdown/keydown）时于手势上下文内重试播放；用户已手动暂停的
   状态不得被手势意外恢复。
2. `loadProgram` 的时长探测按 `track.id` 去重，同一 track 只探测一次，
   结果按 `track.id` 写回所有引用该片目的时长。
3. 不改动 `AmbientBgm` / `ambientBgm` 现有行为；不改 DB、后端、路由。

### 验收

- 见 `.coding-harness/2026-09-09-cinema-bgm-silent/plan.md` 验收标准 A1-A9。
- 验证命令：`cd web-system && npm run build`（本仓库唯一可用的检查命令，
  无 lint/test 脚本）。
