# 审核报告：/cinema 无声修复 + BGM 探测去重（2026-09-09-cinema-bgm-silent）

## 审核结论

Status: **PASS**
总分: **55/60**

## 硬门槛检查结果

| 检查项 | 结果 | 证据 |
|--------|------|------|
| 变更最小性（只动 Cinema.tsx） | ✅ | `git status --short` 仅 `M web-system/src/pages/Cinema.tsx`（+28/-6 中本任务约 +26/-3）+ 任务前已存在的 `generate-ai.mjs`（--compress-width，明确排除在范围外）；无新增 lib/hook/抽象 |
| 无 console.log / 注释代码 / TODO | ✅ | `grep -n "console\.\|TODO\|FIXME" web-system/src/pages/Cinema.tsx` 无命中；diff 中无被注释的可执行行 |
| 无新增 `as` 强转 | ✅ | grep 仅命中 Cinema.tsx:137（`as CinemaMode`，pre-existing 本地存储读取，未在本 diff 中）；diff 新增行无 `as` |
| 无面向过程退化 | ✅ | 新增 `requestGestureRetry`（Cinema.tsx:564-576，13 行闭包）无 ≥3 步顺序变异同一变量、无 ≥3 分支、无贫血模型/Data Clumps；probe 去重用声明式 `Map` + `forEach`（154-167） |
| AmbientBgm 无 diff | ✅ | `git status` 中 `AmbientBgm.tsx` / `ambientBgm.ts` 均无修改（A6） |
| 需求文档存在 | ✅ | `web-system/docs/requirements-2026-09-09.md` 存在（1579B），内容与本任务一致，且引用 plan.md A1-A9（A9） |
| 页面层未越权碰 DB / 无 router 变更 / 单一配置源 / 无 raw SQL | ✅ | 纯前端组件改动，无后端接触 |
| npm run build 通过 | ✅ | Reviewer 独立重跑：`tsc && vite build` exit 0，`✓ built in 4.47s`（A7） |

## 验收标准逐条核对（A1-A9）

| # | 结果 | 证据 |
|---|------|------|
| A1 | ✅ | Cinema.tsx:577 `au.play().catch(requestGestureRetry)` 取代空 catch；564-576 注册一次性 `pointerdown`/`keydown`；handler（566-569）同步检查后直接 `au.play()`，无中间 await，保留 user activation |
| A2 | ✅ | Cinema.tsx:568 重试条件 `playingRef.current && au.paused`；手动暂停（togglePlay:677-687 置 playing=false）后手势不会恢复；React 18 对离散事件同步 flush，window 级监听派发时 playingRef 已更新 |
| A3 | ✅ | Cinema.tsx:602-603 effect cleanup 调用清理函数并置空；`once: true`（570-571）+ ref 判空（565）双重重叠保护；effect deps `[poemIdx, item.track.id]` 变化时 cleanup 先于重跑执行，切诗不叠加 |
| A4 | ✅ | Cinema.tsx:155-158 `Map<track.id, BgmTrack>` 去重；159 对唯一 track 各探测一次 → 探测次数 === 唯一 track 数（消灭最多 5 次重复探测） |
| A5 | ✅ | Cinema.tsx:162-164 函数式 `setProgram(prev => prev.map(...))` 按 `x.track.id === track.id` 写回所有引用片目；`clamp(d, MIN_POEM_S, MAX_POEM_S)` 与 `d > 0` 才更新的语义保留（对比 99-119 probeDuration 未改动） |
| A6 | ✅ | git 文件清单确认 AmbientBgm.tsx / ambientBgm.ts 无 diff |
| A7 | ✅ | Reviewer 独立运行 `npm run build`：✓ built in 4.47s |
| A8 | ✅ | 无新增 `as`；最长新增代码块 13 行；无复制粘贴（与 AmbientBgm 模式同构但局部实现，符合 plan 4.1 Seam 判断） |
| A9 | ✅ | requirements-2026-09-09.md 存在且一致 |

## 逻辑正确性专项

- **重试 play 在用户激活上下文内**：onGesture 为原生事件 handler，内部同步调用 `au.play()`（568），无 await/异步边界，满足 iOS user activation 要求。
- **once 语义**：两个监听均 `{ once: true }`（570-571），且 gesture 触发后 ref 置 null（567），cleanup 函数引用被消费；pending 状态下 cleanup（602）可完整移除两个监听。
- **非阻断观察**（不构成本次回流条件）：gesture 触发后，同对的另一个 `once` 监听（如 pointerdown 已触发则 keydown 残留）会存活到下次事件或 effect cleanup 之前的窗口期；因 `once: true` 有界、且触发条件 `playingRef.current && au.paused` 在手动暂停/退场后均不成立，实际不可达有害路径。该结构与参照实现 AmbientBgm.tsx:31-32 完全同构。可选改进：onGesture 内先调用 `gestureRetryCleanupRef.current?.()` 再置 null，可彻底消掉残留。

## Hard Failures（阻断项）

无。

## Required Fixes（必须修复项）

无。

## 评分

| 维度 | 得分 | 证据 |
|------|------|------|
| 任务完成度 | 9/10 | A1-A9 全部达成，均有文件+行号证据；A3 存在上述非阻断的边缘残留监听观察 |
| 约束遵守度 | 9/10 | 无 DB/router 接触、无新增 as、无 AI 残留物、需求文档齐备；唯一已存 `as`（137 行）为存量 |
| 变更最小性 | 10/10 | diff 每行均可追溯到 A1-A5；未顺手重构；未引入共享抽象（符合 plan Seam 判断） |
| 正确性 | 9/10 | Reviewer 独立重跑 `npm run build` 通过；tsc 通过；去重写回用函数式 setState 无并发覆盖；重试条件与 user activation 语义正确 |
| 代码风格一致性 | 9/10 | 命名沿用 glossary 词汇（BgmTrack/bgmUrl/BGM_VOLUME）；注释风格与文件内既有中文注释一致；与 AmbientBgm 模式同构 |
| 可交付性 | 9/10 | 可直接合并；plan.md、test-evidence.md、diff-summary.md、需求文档齐全 |

## 建议下一步

PASS → 流水线完成。可选（非必须）：后续迭代中在 onGesture 首行加 `gestureRetryCleanupRef.current?.()` 彻底移除同对残留监听，使 A3 在 gesture 已触发路径下也严格无残留。
