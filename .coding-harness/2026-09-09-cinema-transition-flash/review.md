# 审核报告：修复放映厅幕间转场结束时旧图一闪而过

- task-id: `2026-09-09-cinema-transition-flash`
- 审核范围：`git diff` 工作区改动（web-system/src/pages/Cinema.tsx，+6/-1）

## 审核结论

Status: **PASS**
总分: **58/60**

## 硬门槛检查结果

| 检查项 | 结果 | 证据 |
| ------ | ---- | ---- |
| 变更最小性（只动 Cinema.tsx） | ✅ | `git diff --stat`：仅 `Cinema.tsx` +6/-1；`requirements-2026-09-09.md` 为 Planner 既有改动（Executor 未触碰）；`transitionEngine.ts`/`transitions.ts` 无改动 |
| 无 console.log / 注释代码 / TODO | ✅ | diff 全文仅 6 行新增（1 行为说明性注释，非注释掉的代码），无 console、无 TODO |
| 无新增 `as` 强转 | ✅ | diff 中无 `as` 关键字 |
| 无面向过程退化 | ✅ | 新增代码为单一 useEffect（Cinema.tsx:504-507），无 ≥3 步顺序变异、无多分支、无贫血模型/数据簇 |
| 需求文档已追加（A9） | ✅ | `web-system/docs/requirements-2026-09-09.md` 含"修复放映厅幕间转场结束时旧图一闪而过"完整段落（背景/需求 4 条/验收引用） |
| `npm run build` 通过（A7，Fatal） | ✅ | Reviewer 独立执行：`tsc && vite build` 通过，1535 modules transformed，built in 4.05s |
| 页面层未越权碰 DB / 单一配置源 / Drizzle | ✅ | 纯前端组件改动，无 DB/配置/router 接触（N/A，无违例） |

## 时序正确性走读（核心）

**A1/A2 — clear 与 displayed 提交绑定**：`transitionEngine.clear()` 唯一调用点位于 `Cinema.tsx:506`（`useEffect(..., [displayed])` 体内），effect 运行于 React commit 之后，此时底层 `<img>`（738-744）已渲染新 `displayed`，canvas 清空不会暴露旧图。runTransition 的 t=1 分支（493-496）与 `!ok` 分支（486-490）均无内联 clear（原 496 行已删，git diff 确认）。✅

**A3 — 快速连续切幕竞态**：守卫在 effect 体内（505 行，`if (transitioningRef.current) return;`），非依赖数组，每次 displayed 变化都评估。竞态走读：
1. 转场 A 在 rAF 回调完成：`transitioningRef.current = false; setDisplayed(toA)`（494-495），更新入队待提交；
2. 提交前用户触发 goTo B：`runTransition` 同步执行 `transitioningRef.current = true`（480 行）先于 commit；
3. React 提交 displayed=toB 后 effect 执行，读到 `transitioningRef.current === true` → 跳过 clear，B 的 canvas 内容不被清掉。✅
4. 反向顺序（A 的 effect 已 clear，B 后启动）也安全：clear 时 `<img>` 已是 toA，无暴露窗口。✅
5. goTo（538→540，先 setDisplayed 后 runTransition）、nextPoem/prevPoem（557→558、678→679，先 runTransition 后 setDisplayed）、自动模式定时器（626→627）：两条顺序下 transitioningRef 在 commit 前均已为 true，effect 均跳过，不会清掉新转场首帧。✅

**A4 — 失败路径一致**：`!ok` 分支（486-490）置 transitioningRef=false + setDisplayed(to)，clear 由同一 effect 在 commit 后执行，与 t=1 路径完全同构，canvas 无旧帧残留。✅

**A5 — 降级路径不变**：`def.duration <= 0 || !webglOk` 分支（475-478）未改动，仍只 `setDisplayed(to)` 不触碰 canvas；effect 额外执行一次幂等 clear（一次 gl.clear，plan 风险表已认可）。✅

**A6 — 卸载无泄漏**：新 effect（504-507）无订阅/定时器/监听器，无需 cleanup；既有 WebGL cleanup（451-456：removeEventListener、ro.disconnect、destroy、cancelAnimationFrame）未触碰。canvas 为 JSX 内联元素（746 行），随组件卸载由 React 回收。✅

**transitionEngine 语义对照**：`clear()`（transitionEngine.ts:226-232）仍清为全透明（clearColor 0,0,0,0），语义未改；`render()` 返回 false 语义未改。✅

## 验收标准逐条核对

| # | 标准 | 结果 | 证据 |
|---|------| ---- | ---- |
| A1 | t=1 不再旧图闪帧 | ✅ | clear 唯一调用点在 commit 后（Cinema.tsx:504-507） |
| A2 | clear 与提交绑定，无暴露窗口 | ✅ | t=1 与 !ok 分支均无内联 clear（diff 删 1 行） |
| A3 | 快速切幕竞态防护 | ✅ | 505 行守卫 + 上述竞态走读 5 条路径全通 |
| A4 | 失败路径时序一致 | ✅ | !ok 分支（486-490）走同一 effect clear 路径 |
| A5 | 降级路径行为不变 | ✅ | 475-478 未改动 |
| A6 | 卸载无泄漏 | ✅ | cleanup（451-456）未触碰，新 effect 无状态 |
| A7 | npm run build 通过 | ✅ | Reviewer 独立执行通过（tsc 无错，vite 1535 modules） |
| A8 | 无 as / 超长函数 / 复制粘贴 | ✅ | +6/-1 行，runTransition 净删 1 行 |
| A9 | 需求文档已追加 | ✅ | requirements-2026-09-09.md 本任务段落完整 |

## Hard Failures（阻断项）

无。

## Required Fixes（必须修复项）

无。

## 评分

| 维度 | 得分 | 证据 |
| ---- | ---- | ---- |
| 任务完成度 | 10/10 | A1-A9 全部达成，每条有走读/命令证据 |
| 约束遵守度 | 10/10 | 无 DB/router/配置触碰；clear 语义、降级分支、销毁逻辑均未动 |
| 变更最小性 | 10/10 | diff 每行可追溯到 A1-A3（+6/-1，无顺手改动） |
| 正确性 | 9/10 | build 独立通过、类型安全；无测试框架可用，正确性依赖走读（仓库固有限制，plan 已声明） |
| 代码风格一致性 | 10/10 | 沿用既有 useEffect + ref 守卫模式，注释风格与文件内既有注释一致 |
| 可交付性 | 9/10 | 可直接合并；建议后续补一条 ADR 或经验记录："canvas 清屏时机必须绑定状态提交，不得内联于异步回调" |

## 建议下一步

PASS → 流水线完成。可选（Info 级）：将"WebGL 画布清屏时机须绑定 React 状态提交"记入经验库，防止其他页面复现同类时序缺陷。
