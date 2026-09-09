# Plan: 修复放映厅（/cinema）无声音 + BGM 时长探测重复请求

- task-id: `2026-09-09-cinema-bgm-silent`
- 日期: 2026-09-09
- 角色: Planner（本文件交付后由 Executor 执行，Reviewer 审核）

---

## 1. 任务目标

修复 https://poetry.askfount.com/cinema 放映厅（Theater）进入后背景音乐永久无声的问题，
并消除片单加载时对同一 BGM track 的重复时长探测请求。

根因（已调查完毕，Executor 直接采信，不要重新调查）：

1. **主因 — 自动播放被拒后无重试**：`Theater` 在 `useEffect` 中（Cinema.tsx:550-584）
   对 `<audio>` 调 `au.play().catch(() => {})`。在 iOS Safari 等严格自动播放策略下，
   effect 中异步触发的 `play()` 不在用户手势（user activation）上下文内，被
   `NotAllowedError` 拒绝；catch 吞掉错误，且没有任何"等下一次用户手势重试"的机制。
   对照：`AmbientBgm`（src/components/AmbientBgm.tsx:25-37）通过首次
   `pointerdown`/`keydown` 手势调用 `startAmbientBgm()` 重试，因此首页/画廊有声。
2. **次因 — probeDuration 不去重**：`loadProgram`（Cinema.tsx:155-161）对 10 部影片
   逐个 `probeDuration(it.track)`，片单中同一 track（如 `bgm-yueye-01`）最多被复用 2 次
   （buildProgram 的 `used` 计数允许 ≤2），实测同一 track 被重复探测多达 5 次，
   与主音频播放争抢网络。

## 2. 影响层级

| 层级 | 是否涉及 | 说明 |
|------|---------|------|
| 前端页面组件 | ✅ | `web-system/src/pages/Cinema.tsx`（Theater 音频逻辑 + loadProgram） |
| 前端 lib / hooks | 可能 | 若提取共享手势重试 helper，则新增 `src/lib/` 下小模块；否则无 |
| 后端 API / router | ❌ | |
| DB schema / migrations | ❌ | 不涉及 `npm run db:generate` |
| 环境变量 | ❌ | |

## 3. 必读文件

| 文件 | 读什么 |
|------|--------|
| `web-system/src/pages/Cinema.tsx` | `Theater` 音频 useEffect（550-584 行）、`togglePlay`（655-665）、`probeDuration`（99-119）、`loadProgram`（143-171）、`buildProgram` 的 track 复用逻辑（82-96） |
| `web-system/src/components/AmbientBgm.tsx` | 手势重试模式参考：`pointerdown`/`keydown` + `{ once: true }`（25-37 行） |
| `web-system/src/lib/ambientBgm.ts` | `wantPlaying` 标志 + `playCurrent()` 的注释语义（60-65 行） |
| `web-system/src/lib/bgm.ts` | `BgmTrack`（1 行）、`fetchBgmTracks`（91）、`bgmUrl`（102）、`BGM_VOLUME`（15） |
| `web-system/package.json` | 验证命令确认：仅存在 `build`（`tsc && vite build`），无 `check`/`lint`/`test` 脚本 |

## 4. 实现方案（方向性，细节由 Executor 定）

### 4.1 Theater 音频手势重试（主修复）

- 在 `Theater` 内增加与 `AmbientBgm` 同构的重试机制：当
  `au.play()` 被 reject（或 `play()` 时 `au.paused` 且处于 playing 状态）时，
  注册一次性的 `window` `pointerdown`/`keydown` 监听；手势到达时在用户激活上下文内
  重新 `au.play()`。
- **关键约束**：重试前必须检查"用户仍想播"——`playingRef.current === true`、未被
  `toggleMute` 之外的因素暂停；用户手动暂停（空格/按钮）后手势不应意外恢复播放。
  即重试条件 = `playingRef.current && au.paused`。
- 监听随组件卸载清理；切换诗（poemIdx 变化）不应累积重复监听。
- **不建议**为本任务引入新的共享 lib/hook（Seam 原则：提取后仅有 Theater 一个真实
  Adapter，AmbientBgm 已自成一体不宜改动）。在 Theater 内做小范围手术式修改即可；
  若 Executor 发现两处代码完全同构且提取成本极低，可在 plan 备注中说明后提取，
  但默认保持局部实现。
- 不需要改 `AmbientBgm`（它已在 `/cinema` 路径自管让位，`isSelfManaged` 逻辑正确）。

### 4.2 probeDuration 按 track.id 去重（次修复）

- `loadProgram` 中先按 `track.id` 去重得到唯一 track 集合，每个 track 只
  `probeDuration` 一次；结果写回时按 `track.id` 匹配更新所有使用该 track 的片目
  （替代现有的按下标 `xi === i` 更新）。
- 注意 `setProgram` 的函数式更新需基于最新 state，避免多次 probe 结果互相覆盖；
- 保留 8s 超时兜底与 `d > 0` 才更新的语义；探测失败（0）不覆盖已有值的行为不变。

## 5. 验收标准（Reviewer 逐条可检查）

| # | 标准 | 检查方式 |
|---|------|---------|
| A1 | Theater 挂载后首次 `play()` 被 reject 时，会注册手势重试；下一次 `pointerdown`/`keydown` 手势在用户激活上下文内重新调用 `play()` | 代码走读：play().catch 分支不再是空 catch；存在 pointerdown/keydown 一次性监听并在手势中重试 play |
| A2 | 用户主动暂停（空格/暂停按钮/togglePlay）后，普通点击屏幕不会意外恢复声音 | 代码走读：重试前置条件含 `playingRef.current === true && au.paused` |
| A3 | 手势监听器在 Theater 卸载时移除，且在连续切诗过程中不重复叠加 | 代码走读：useEffect cleanup 移除监听；监听器注册有 once 或等价去重保护 |
| A4 | `loadProgram` 对相同 `track.id` 只调用一次 `probeDuration`；10 部片单若只有 N 个唯一 track，则探测次数 === N | 代码走读 + 可用计数断言/手动日志验证；原有"同 track 重复探测 5 次"场景消失 |
| A5 | probe 结果按 `track.id` 写回所有引用该 track 的片目，`duration` clamp 到 [MIN_POEM_S, MAX_POEM_S] 语义不变；探测失败不覆盖 | 代码走读 |
| A6 | 不改动 `AmbientBgm.tsx` / `ambientBgm.ts` 的行为（diff 中这两文件无修改，除非有充分说明） | `git diff` 文件清单 |
| A7 | `cd web-system && npm run build` 通过（`tsc && vite build`，即类型检查 + 构建均过） | 命令输出 |
| A8 | 无新增 `as` 强转、无新增超长函数（>50 行）、无复制粘贴式重复代码（repo-rules 已知坏味道） | 代码走读 |
| A9 | 需求文档 `web-system/docs/requirements-2026-09-09.md` 已存在且与本任务一致 | 文件检查 |

说明：本仓库 `package.json` 中**不存在** `check`/`lint`/`test` 脚本
（repo-rules.md 所列命令与本仓库实际不符，以 package.json 为准），
故验证命令为 `npm run build`；无测试框架可用，不做单元测试要求。

## 6. 风险点

| 风险 | 缓解 |
|------|------|
| 手势重试误恢复用户已手动暂停的音频（体验 bug） | 重试条件必须同时检查 `playingRef.current` 与 `au.paused`（A2） |
| 切诗时 effect 重跑导致重复注册监听 / 泄漏 | 手势监听放在独立的 mount-only effect 或妥善 cleanup（A3） |
| iOS 要求 play() 必须直接在手势 handler 内调用，套 async/await 可能丢失 user activation | 手势 handler 中同步、直接调 `au.play()`，不做中间 await |
| 去重后 probe 写回由"按下标"改为"按 track.id"，setProgram 并发更新可能互相覆盖 | 使用函数式 setState，基于 prev 全量映射，Executor 自测多 track 场景 |
| 片单 track 复用上限为 2（buildProgram `used` 计数），去重后探测数从最多 10 降到 ≤ 唯一 track 数，属预期行为变化 | 在 PR/提交说明中注明 |
| 8s 探测超时在网络差时仍可能与主音频竞争 | 维持现状，本任务不做预载调度重构（范围外） |

## 7. 术语对齐（domain-glossary）

- 本项目 glossary 未收录音频/放映领域术语；沿用现有代码词汇：
  `BgmTrack`、`bgmUrl`、`BGM_VOLUME`（src/lib/bgm.ts）、`startAmbientBgm` /
  `pauseAmbientBgm`（src/lib/ambientBgm.ts）。新命名不得引入同义词
  （如不得另造 `Music`/`Song` 指代 `BgmTrack`）。
- 若提取共享模块，遵循 Module/Interface/Seam 原则：仅当存在 2 个真实 Adapter
  （生产 + 测试，或 Theater + AmbientBgm 同时复用）才提取；否则保持局部实现。
- 业务侧无 Task/Credits 等领域概念涉及。
