# 变更摘要

- task-id: `2026-09-09-cinema-bgm-silent`

## 变更文件列表

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `web-system/src/pages/Cinema.tsx` | 修改 | Theater 音频手势重试（A1-A3）+ loadProgram probeDuration 按 track.id 去重（A4-A5） |

注：`web-system/scripts/generate-ai.mjs` 的改动为任务开始前已存在的无关改动，非本任务产生；
`.coding-harness/` 与 `web-system/docs/requirements-2026-09-09.md` 为任务产物/需求文档（A9 已存在）。

## 变更范围（git diff --stat，仅 Cinema.tsx）

- 新增代码行数（估算）：+26
- 修改代码行数（估算）：~4（含注释更新）
- 删除代码行数（估算）：-3

### 具体变更

1. **Theater 音频手势重试**（Cinema.tsx Theater 组件）
   - 新增 `gestureRetryCleanupRef = useRef<(() => void) | null>(null)`；
   - 音频 effect 内 `requestGestureRetry`：`au.play().catch(requestGestureRetry)` 取代空 catch；
     首次 reject 后注册一次性 `pointerdown`/`keydown` 监听（ref 判空防重复注册）；
   - 手势 handler 同步检查 `playingRef.current && au.paused` 后直接 `au.play()`（保留 user activation，
     用户手动暂停后不误恢复）；
   - effect cleanup 移除监听（切诗/卸载不叠加、不泄漏）。
2. **probeDuration 去重**（loadProgram）
   - `Map<track.id, BgmTrack>` 去重，唯一 track 各探测一次（10 部片单探测数 = 唯一 track 数 ≤ 10，
     消灭同 track 重复探测最多 5 次的问题）；
   - 写回改为函数式 `setProgram` 按 `x.track.id === track.id` 匹配更新所有引用片目；
     `clamp(d, MIN_POEM_S, MAX_POEM_S)` 与 `d > 0` 才更新、探测失败不覆盖的语义不变。

## 影响层级确认

| 层级 | plan 标注 | 实际 | 一致 |
|------|----------|------|------|
| 前端页面组件 Cinema.tsx | ✅ | 已修改 | ✅ |
| 前端 lib / hooks | 可能（仅当提取共享 helper） | 未新增，保持 Theater 局部实现（遵循 Seam 原则，AmbientBgm 自成一体未动） | ✅ |
| 后端 API / router | ❌ | 未触碰 | ✅ |
| DB schema / migrations | ❌ | 未触碰 | ✅ |
| 环境变量 | ❌ | 未触碰 | ✅ |

## 不做的事确认

- 未改 `AmbientBgm.tsx` / `ambientBgm.ts`（A6，git diff 清单确认）；
- 未引入新共享 lib/hook（plan 4.1 默认局部实现）；
- 未做预载调度重构、未改 8s 超时（plan 风险表范围外）；
- 无 console.log、无注释掉的代码、无 TODO、无新增 `as` 强转（走读确认）；
- 未改动无关文件。

## 验证结果

- `cd web-system && npm run build`（`tsc && vite build`）：✅ 通过，exit 0，`✓ built in 4.42s`
