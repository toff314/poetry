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

## 需求：修复放映厅幕间转场结束时旧图一闪而过

### 背景与问题

放映厅（/cinema）Theater 幕间 WebGL 转场完成瞬间，底层 `<img>` 会短暂
闪现上一幕旧图（旧图闪一帧）。

根因：`runTransition`（src/pages/Cinema.tsx:469-500）在转场 t=1 时
`setDisplayed(to)`（React 异步提交）后立即 `transitionEngine.clear()`
（同步清空 canvas）。画布透明后、React 提交新 `displayed` 之前，
底层 `<img>` 仍渲染旧场景，旧图闪一帧；`render` 失败（`!ok`）分支
同样缺少 clear 时序管理。

### 需求描述

1. canvas 的 `clear()` 时机必须与 `displayed` 状态提交绑定（例如在
   `useEffect(..., [displayed])` 中 clear，或 `flushSync` 提交后 clear），
   保证任一时刻"画布非空 ⇒ 画布覆盖底层 `<img>`"。
2. 竞态防护：转场进行中（`transitioningRef.current === true`）effect
   clear 不得执行，连续快速切幕不打断新转场。
3. 失败路径（`render` 返回 false）与正常完成路径的 clear 时序一致。
4. 不改 `transitionEngine.clear()` 的语义；不改降级路径
   （duration<=0 / !webglOk）行为；不改 DB、后端、路由。

### 验收

- 见 `.coding-harness/2026-09-09-cinema-transition-flash/plan.md` 验收标准 A1-A9。
- 验证命令：`cd web-system && npm run build`。
