# TDD 测试证据

- task-id: `2026-09-09-cinema-bgm-silent`
- 验证命令：`cd web-system && npm run build`（`tsc && vite build`）

## 关于 TDD 红/绿阶段的说明（无测试框架）

`web-system/package.json` scripts 仅含 `dev` / `client:dev` / `server:dev` / `build` / `serve` /
`poem:generate`，**不存在任何测试框架或 `test` 脚本**（repo-rules.md 所列 `check`/`lint`/`test`
与本仓库实际不符，以 package.json 为准，plan.md 第 87-89 行已确认不做单元测试要求）。
因此 TDD 的红/绿阶段以 **代码走读对照验收标准 + `tsc` 类型检查** 为判定手段：
- 红阶段 = 走读确认现状代码不满足该条验收标准（如空 catch、逐条探测）；
- 绿阶段 = 实现后 `npx tsc` 通过 + 走读确认验收标准达成；
- 全部切片完成后跑唯一可用全量验证 `npm run build`。
仍严格按垂直切片顺序逐条验收标准实现，每片实现后立即验证。

## Tracer Bullet

- 第一个验收标准：A1（Theater 首次 `play()` 被拒后注册手势重试，下一次 pointerdown/keydown 在
  用户激活上下文内重试 play；含 A2 重试前置条件、A3 清理不叠加）
- 红阶段结果（代码走读）：`Cinema.tsx` 音频 effect 中 `au.play().catch(() => {})` 为空 catch，
  无任何手势监听注册 → A1 不满足。`npx tsc` 基线通过（exit 0）。
- 实现文件：`web-system/src/pages/Cinema.tsx`（Theater 组件）
  - 新增 `gestureRetryCleanupRef`（ref，保存监听清理函数，防重复注册）；
  - 音频 effect 内 `requestGestureRetry`：`play()` reject 后注册一次性
    `pointerdown`/`keydown` 监听；手势 handler 同步、直接检查
    `playingRef.current && au.paused` 后调用 `au.play()`（无中间 await，保留 user activation，
    同时满足 A2：用户手动暂停后 `playingRef.current === false`，手势不会恢复）；
  - effect cleanup 中 `gestureRetryCleanupRef.current?.()` 移除监听（切诗 effect 重跑与卸载均触发，
    叠加被 ref 判空防住 → A3）。
- 绿阶段结果：`npx tsc` exit 0；走读确认 A1/A2/A3 达成。

## 增量循环

| 验收标准 | 红阶段结果（走读） | 实现文件 | 绿阶段结果 |
|---------|------------------|---------|-----------|
| A4（同一 track.id 只 probe 一次，探测次数 === 唯一 track 数） | 现状 `items.forEach` 逐片探测 10 次，同 track 最多 5 次 | `web-system/src/pages/Cinema.tsx` loadProgram | `npx tsc` exit 0；`Map<track.id, track>` 去重后 forEach 探测 |
| A5（按 track.id 写回所有引用片目，clamp/fail 语义不变） | 现状按数组下标 `xi === i` 写回 | 同上 | `npx tsc` exit 0；函数式 `setProgram(prev => prev.map(x => x.track.id === track.id ? ...))`，clamp 与 `d > 0` 判断保留 |
| A6（不改 AmbientBgm.tsx / ambientBgm.ts） | — | — | `git diff` 文件清单仅含 Cinema.tsx（generate-ai.mjs 为任务前已存在的无关改动） |
| A7（npm run build 通过） | — | — | 见"全量验证" |
| A8（无新增 as 强转/超长函数/复制粘贴） | — | — | 走读：`as` 仅存量 1 处（line 137 原有）；requestGestureRetry ~13 行；无复制粘贴 |
| A9（requirements-2026-09-09.md 存在） | — | — | 文件存在（任务前已建立） |

## 重构阶段

无（实现已最小，无重复/过长问题）。

## 全量验证

| 命令 | 结果 | 关键信息 |
|------|------|---------|
| npm run check | 未涉及 | package.json 无此脚本 |
| npm run lint | 未涉及 | package.json 无此脚本 |
| npm run test | 未涉及 | package.json 无此脚本、无测试框架 |
| npm run build | ✅ | `tsc && vite build` 均通过，`✓ built in 4.42s`，exit 0 |
| npm run db:generate | 未涉及 | 无 DB 变更 |
