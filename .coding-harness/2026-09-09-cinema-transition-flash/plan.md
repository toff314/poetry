# Plan: 修复放映厅幕间转场结束时旧图一闪而过

- task-id: `2026-09-09-cinema-transition-flash`
- 日期: 2026-09-09
- 角色: Planner（本文件交付后由 Executor 执行，Reviewer 审核）

---

## 1. 任务目标

修复放映厅（/cinema）Theater 幕间转场完成瞬间，底层 `<img>` 短暂闪现上一幕旧图
（旧图闪一帧）的问题。

根因（已确认，Executor 直接采信，不要重新调查）：

`runTransition`（Cinema.tsx:469-500）中，WebGL 转场在 canvas 上逐帧渲染
fromImg→toImg；t=1 时执行：

```ts
transitioningRef.current = false;
setDisplayed(to);            // React 状态提交在下一帧渲染，异步
transitionEngine.clear();    // 立即清空 canvas，画布变透明
```

`clear()` 立即清空了 canvas，而 `setDisplayed(to)` 的状态提交要到下一次 React
commit 才生效——画布透明后、`<img>`（734-738 行，渲染 `displayed` 场景）仍显示
旧图，旧图闪一帧。失败路径 `if (!ok)`（486-490 行）只有 `setDisplayed(to)`、
无 clear 管理，canvas 停在已渲染内容（行为靠新转场覆盖，时序不一致）。

## 2. 影响层级

| 层级 | 是否涉及 | 说明 |
|------|---------|------|
| 前端页面组件 | ✅ | `web-system/src/pages/Cinema.tsx`（Theater 的 runTransition + displayed 状态） |
| 前端 lib | 否/可能 | `web-system/src/lib/transitionEngine.ts` 原则上不改（clear 语义本身正确，是调用时机错）；仅当 Executor 判断需要引擎提供查询能力（如 `get available`）时允许小改 |
| 后端 API / router | ❌ | |
| DB schema / migrations | ❌ | |
| 环境变量 | ❌ | |

## 3. 必读文件

| 文件 | 读什么 |
|------|--------|
| `web-system/src/pages/Cinema.tsx` | `runTransition`（469-500）、`goTo`（505-539）、`nextPoem`（543-554）、`prevPoem`（668-675）、`displayed`/`displayedRef` 状态（399-412）、底层 `<img>` 与 `<canvas>` 渲染层（732-741） |
| `web-system/src/lib/transitionEngine.ts` | `clear()`（226-232，清为全透明）、`render()`（165-224，返回 false 语义） |
| `web-system/src/lib/transitions.ts` | `getTransition` / `TransitionDef.duration`（duration<=0 的降级分支） |

## 4. 实现方案（方向性，细节由 Executor 定）

### 4.1 核心原则

canvas 的 `clear()` 时机必须与 `displayed` 状态提交绑定，保证任一时刻
"画布非空 ⇒ 画布覆盖底层 `<img>`"。推荐方向（Executor 可二选一或提出等价方案）：

- **方案 A（推荐）**：新增 `useEffect(..., [displayed])`，在 displayed 提交
  （effect 运行于 commit 之后）后调用 `transitionEngine.clear()`；同时从
  runTransition 的 t=1 分支与 `!ok` 分支中移除内联 `clear()`。
- **方案 B**：用 `flushSync(() => setDisplayed(to))` 同步提交后再 `clear()`。

### 4.2 竞态防护（连续快速转场）

- effect clear 执行前必须检查 `transitioningRef.current === false`，否则
  不打断进行中的新转场：快速连续切幕时，旧转场的 effect clear 不能清掉
  新转场正在 canvas 上渲染的内容。
- 检查放在 effect 体内（而非依赖数组），确保每次 displayed 变化都会评估。
- 若采用方案 B，同样需保证 flushSync 不与其他渲染路径嵌套冲突（React 18+
  flushSync 警告）；方案 A 无此问题。

### 4.3 失败路径

- `if (!ok)` 分支：与 t=1 分支走同一套"提交 displayed 后 clear"逻辑，
  不再留下旧帧在 canvas 上。

### 4.4 约束

- 不改 `transitionEngine.clear()` 的语义（仍清为全透明）。
- 不改转场的逐帧渲染流程与降级分支（duration<=0 / !webglOk 直接
  setDisplayed，无 canvas 参与）的行为。
- 小范围手术式修改，runTransition 不得因改动超过 50 行（Long Method 坏味道）。

## 5. 验收标准（Reviewer 逐条可检查）

| # | 标准 | 检查方式 |
|---|------|---------|
| A1 | 转场完成帧（t=1）不再出现旧图：clear 不再先于 displayed 提交执行 | 代码走读：`clear()` 的唯一调用点位于 `useEffect(..., [displayed])`（commit 后）或 flushSync 之后 |
| A2 | clear 时机与 displayed 提交绑定：同一逻辑路径上不存在"clear 后还有 setDisplayed 待提交"的窗口 | 代码走读：runTransition 的 t=1 与 `!ok` 分支中无内联 `clear()` |
| A3 | 连续快速切幕无中断竞态：转场进行中（`transitioningRef.current === true`）effect clear 不执行 | 代码走读：effect 体内含 transitioning 守卫；走读"转场 A 完成→用户立即触发转场 B"场景确认 canvas 内容不被 A 的 effect 清掉 |
| A4 | 失败路径（`render` 返回 false）与正常完成路径的 clear 时序一致，canvas 不残留旧帧 | 代码走读 |
| A5 | 降级路径（`def.duration <= 0` / `!webglOk`）行为不变：直接 setDisplayed，不触碰 canvas | 代码走读 + `git diff` |
| A6 | 组件卸载时无泄漏/残留：引擎销毁逻辑（455-456 行 cleanup）不受影响 | 代码走读 |
| A7 | `cd web-system && npm run build` 通过（`tsc && vite build`） | 命令输出 |
| A8 | 无新增 `as` 强转、无新增超长函数、无复制粘贴式重复代码 | 代码走读 |
| A9 | 需求文档 `web-system/docs/requirements-2026-09-09.md` 已追加本需求段落 | 文件检查 |

说明：本仓库 `package.json` 中**不存在** `check`/`lint`/`test` 脚本
（repo-rules.md 所列命令与本仓库实际不符，以 package.json 为准），
故验证命令为 `npm run build`；无测试框架可用，不做单元测试要求。

## 6. 风险点

| 风险 | 缓解 |
|------|------|
| effect clear 打断进行中的新转场（快速连续切幕时旧 effect 清掉新画面） | effect 体内检查 `transitioningRef.current`（A3）；注意 effect 闭包读取 ref 是安全的 |
| 方案 B（flushSync）可能触发 React "flushSync inside lifecycle" 警告或与并发的其他 setState 冲突 | 推荐方案 A；若用 B，须确认 runTransition 不处于 React 事件/渲染栈内 |
| displayed 变化并非全部来自转场（如降级路径直接 setDisplayed），effect clear 多跑一次 | clear 幂等且代价极低（一次 gl.clear），可接受 |
| `goTo`/`nextPoem`/`prevPoem` 中 setDisplayed 与 runTransition 的既有调用顺序（先 setDisplayed 后 runTransition）与 effect clear 交互 | Executor 走读三处调用点，确认 effect clear 不会清掉刚启动转场的第一帧（转场首帧 render 是异步的，靠 transitioningRef 已置 true 防护） |
| Theater 重挂载（退出再入场）后 canvas/引擎状态 | 既有 init/destroy 生命周期不变，本任务不触碰 |

## 7. 术语对齐（domain-glossary）

- 本项目 glossary 未收录放映/转场领域术语；沿用现有代码词汇：
  `TransitionEngine` / `transitionEngine`、`TransitionDef`、`runTransition`、
  `displayed` / `displayedRef`、`transitioningRef`、`webglOk`。
  新命名不得引入同义词（如不得另造 `WipeEngine`/`SlideEffect` 指代
  `TransitionEngine`）。
- `clear` 语义不变：清空 canvas 为全透明，仅调用时机修正。
- 业务侧无 Task/Credits 等领域概念涉及。
