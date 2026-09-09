# TDD 测试证据

- task-id: `2026-09-09-cinema-transition-flash`

## 环境说明（红/绿阶段限制）

本仓库 `package.json` 仅有 `build`/`dev`/`serve`/`poem:generate` 脚本，
**无 `check`/`lint`/`test` 脚本、无测试框架**（与 repo-rules.md 所列命令不符，
以 package.json 为准，plan.md 第 5 节已声明）。因此：

- 红阶段无法以"运行测试失败"呈现：验收标准 A1-A9 为代码走读型，"红"体现为
  修复前代码走读确认缺陷存在（下述）。
- 绿阶段以 `npm run build`（`tsc && vite build`，含完整 TypeScript 类型检查）
  通过 + 逐条代码走读作为验证手段，按 tracer bullet 方式逐条验收标准实现。

## Tracer Bullet（A1+A2：核心修复）

- 验收标准：A1（t=1 不再旧图闪帧）、A2（clear 与 displayed 提交绑定）
- 红阶段（修复前走读确认缺陷）：
  - `Cinema.tsx:494-497`：t=1 分支 `setDisplayed(to)`（React 异步提交）后立即
    `transitionEngine.clear()`（同步清空 canvas），画布透明→React commit 之间
    底层 `<img>`（732-738 行，渲染旧 `displayed`）暴露一帧。
  - 唯一 clear 调用点位于 runTransition 内联，先于 displayed 提交执行 → A1/A2 违例确认。
- 实现文件：`web-system/src/pages/Cinema.tsx`
  - 新增 `useEffect(..., [displayed])`（503-507 行附近）：commit 后
    `transitionEngine.clear()`。
  - 删除 t=1 分支内联 `transitionEngine.clear()`。
- 绿阶段：`npm run build` ✅ 通过（tsc 无错误，vite build 成功，1535 modules）。

## 增量循环

| 验收标准 | 红阶段结果 | 实现 | 绿阶段结果 |
| --------- | ---------- | ---- | ---------- |
| A1 t=1 无旧图闪帧 | 走读确认旧代码 clear 先于提交（见上） | effect clear + 删内联 clear | build ✅ |
| A2 clear 与提交绑定 | 同上，runTransition 两分支均有/缺 clear 时序问题 | 唯一调用点移至 effect（commit 后） | build ✅ |
| A3 快速连续切幕竞态防护 | 走读推演：转场 A 完成→立即触发 B，A 的 effect 若执行会清掉 B 的首帧 | effect 体内 `if (transitioningRef.current) return;` 守卫 | build ✅ + 走读确认 |
| A4 失败路径时序一致 | 旧 `!ok` 分支（原 486-490）无 clear 管理，canvas 残留旧帧 | 该分支仅 `setDisplayed(to)`，clear 由 effect 统一执行，与 t=1 同一路径 | build ✅ |
| A5 降级路径行为不变 | 走读确认 `def.duration <= 0 \|\| !webglOk` 分支（原 475-478）本就只 `setDisplayed(to)` 不触碰 canvas | 未改动该分支；effect 多执行一次幂等 clear（代价一次 gl.clear，plan 风险表已认可） | build ✅ |
| A6 卸载无泄漏 | 走读确认 WebGL init effect cleanup（destroy + cancelAnimationFrame）未触碰 | 未改动；新 effect 无订阅/定时器，无需 cleanup | build ✅ |
| A7 npm run build 通过 | — | — | ✅ `tsc && vite build` 通过 |
| A8 无 as 强转/超长函数/复制粘贴 | — | diff 共 +6/-1 行；无 `as`、无新增长函数、无重复代码 | build ✅ |
| A9 需求文档已追加 | — | `docs/requirements-2026-09-09.md` 已由 Planner 追加本需求段落（工作区既有改动，Executor 未改动） | 文件检查 ✅ |

## 关键调用顺序走读（A3 / plan 风险表第 4 条）

- `goTo`（534-540 行附近）：先 `setDisplayed(to)` 后 `runTransition(from, to)`。
  React 18 事件内批量提交，`runTransition` 同步将 `transitioningRef.current = true`
  先于 commit 完成 → 随后 effect 因守卫跳过 clear，不会误清转场首帧 ✅
- `nextPoem`（549-556）：先 `runTransition`（同步置 transitioningRef=true）后
  `setDisplayed(to)` → effect 同样被守卫跳过 ✅
- `prevPoem`（674-681）：同 nextPoem ✅
- 自动模式定时器（620-628）：setDisplayed 与 runTransition 同一次宏任务，
  同 goTo 推理 ✅
- 转场 A 完成 → 用户立即切幕 B：A 的 `setDisplayed` 与 B 的
  `transitioningRef.current = true` 都已在 B 的事件处理器内完成，
  A 延迟到 commit 后的 effect 读到 `transitioningRef.current === true` → 跳过，
  B 的 canvas 内容不被清掉 ✅
- 首帧保护：组件挂载时 effect 执行一次 clear，此时 canvas 本就为空（init 后无渲染），
  无害 ✅
- Theater 卸载：既有 cleanup（destroy + cancelAnimationFrame）覆盖，新 effect 无需
  也不应新增清理 ✅

## 全量验证

| 命令 | 结果 | 关键信息 |
| ---- | ---- | -------- |
| npm run check | 未涉及（脚本不存在，tsc 已包含在 build 内） | — |
| npm run lint | 未涉及（脚本不存在） | — |
| npm run test | 未涉及（无测试框架） | — |
| npm run build | ✅ | `tsc && vite build` 通过，1535 modules transformed，built in 3.97s |
| npm run db:generate | 未涉及（无 DB 变更） | — |
