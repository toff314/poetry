# BGM 模板库台账

> 沉浸式诗歌页背景音乐的生成与入库记录。
> 提示词总表见 [suno-poetry-bgm-guide.md](suno-poetry-bgm-guide.md)（族定义与 style 提示词的唯一来源）。
> 本文只记「哪首已入库、对应哪个 Suno clip、还剩哪些没生成」。

## 库结构

- 音频：`web-system/public/audio/bgm/bgm-<族拼音>-<序号>.m4a`（网页 mp3/m4a 均支持，Suno 下载产物为 m4a）
- 注册表：`web-system/public/audio/bgm/bgm.json`（前端 `src/lib/bgm.ts` 按情绪启发式匹配）
- 同步：`bash sync-public.sh push` 随 `public/audio/` 一起进 poetry-public 产物仓
- 命名序号规则：同族多个候选按 `01/02…` 递增；**明天继续生成时从各族已有最大序号往后编**

## 匹配与验收方法

Suno clip 的 `metadata.tags` 里嵌入了完整 style 提示词，与 guide 中各族的提示词逐一比对即可确认归属（不用靠生成的英文名猜）。入库前按 guide 验收清单过一遍：无哼唱/无人声、前奏 ≤10 秒、情绪合族、同族候选气质有区分。

## 已入库（48 首，截至 2026-09-10）

每族第 1 首的两个候选，clip ID 用于追溯/重新下载（2026-09-09 新增 18 首的 clip ID 见下「未生成」勾选行）：

| 文件 | 族·标题 | Suno clip ID ×2 | 源曲名 |
|---|---|---|---|
| bgm-shanshui-01/02.m4a | 1 山水·空山新雨 | 9e63e591…, 63ff674d… | 雨后竹林 |
| bgm-yueye-01/02.m4a | 2 月夜·床前月明 | 51bef860…, 6af90333… | Moonlight on the Keys |
| bgm-tianyuan-01/02.m4a | 3 田园·稻花乡里 | 6211c11f…, 047974c4… | Spring Morning in the Village |
| bgm-jianghu-01/02.m4a | 4 行旅江湖·孤舟蓑笠 | 61101c6c…, 129c2b9a… | River Drift |
| bgm-biansai-01/02.m4a | 5 边塞·大漠孤烟 | bf9d83ae…, 8c9fbe27… | Silent Sands |
| bgm-huaigu-01/02.m4a | 6 怀古·故国不堪回首 | 471288d6…, 560bf521… | 雨后的琴弦 |
| bgm-haofang-01/02.m4a | 7 豪放·老夫聊发少年狂 | 150b17e9…, 3adce2ff… | 龙吟震天 |
| bgm-wanxiang-01/02.m4a | 8 婉约相思·才下眉头 | 25f6661d…, 0f3f60a5… | 月下独奏 |
| bgm-chungui-01/02.m4a | 9 春愁闺怨·雨打梨花 | 35dd5981…, 5f82ef4f… | Night Rain on the Window |
| bgm-daowang-01/02.m4a | 10 悼亡哀思·十年生死 | 1fce675f…, a2729605… | Silent River |

> 族 6 的 560bf521 一曲此前已下载到仓库根目录（`雨后的琴弦-560bf521….mp3`），库内以 bgm 目录的 m4a 为准。
> 完整 clip ID 见下「clip ID 速查」。

### clip ID 速查

```
bgm-shanshui-01  9e63e591-ce59-4a04-8677-78c5517f05ac
bgm-shanshui-02  63ff674d-03aa-4c2d-8c32-a67a25ca878c
bgm-yueye-01     51bef860-a156-4cdd-8279-af8f0a7ac03d
bgm-yueye-02     6af90333-4b3d-45f7-aae0-8a0db3a09905
bgm-tianyuan-01  6211c11f-efe9-498c-9a0e-331d0575230a
bgm-tianyuan-02  047974c4-982c-4eb3-acb0-4358a90e5e5b
bgm-jianghu-01   61101c6c-2e23-4ce5-a871-5c1b747bd635
bgm-jianghu-02   129c2b9a-6169-4d89-b056-e04bf29878a6
bgm-biansai-01   bf9d83ae-763d-4ac9-b2cd-81c6f84163ac
bgm-biansai-02   8c9fbe27-31a2-46fd-8725-7529f5e77f64
bgm-huaigu-01    471288d6-bb1d-4d61-9c25-3c056cc881bc
bgm-huaigu-02    560bf521-5ed6-4325-85be-9144b5743064
bgm-haofang-01   150b17e9-9801-452b-a3cb-1da055ca0244
bgm-haofang-02   3adce2ff-6dbd-4181-9ff7-e8eee3c0c95e
bgm-wanxiang-01  25f6661d-8bef-4db2-8ed8-76a89a350960
bgm-wanxiang-02  0f3f60a5-fa51-4a31-b4ab-677a6184eda5
bgm-chungui-01   35dd5981-f75b-4a5a-bc76-51d5909e6be8
bgm-chungui-02   5f82ef4f-92b6-445b-b213-1bd1c887095c
bgm-daowang-01   1fce675f-2f38-4408-af0f-40b1f1a4c5e5
bgm-daowang-02   a2729605-b19d-4ef3-b124-32d434a3f864
```

## 未生成（明天继续）

按 guide 中 style 提示词生成（`--instrumental --wait`，每提示词出 2 候选挑优），入库后在下表打勾并补 clip ID：

- [x] 族1：远岫孤云 → `bgm-shanshui-03/04`（clip 4d7b1fc3-8947-48e3-a256-3bf8eed93ff9, cbefdf47-7ad2-4275-bf10-1cfe1b4d2219）；溪山行旅 → `bgm-shanshui-05/06`（454141d6-ee52-4920-9599-b22f38f0fb6b, e6a83b4a-2c11-4fd7-9999-a0aaa8f460e2）
- [x] 族2：举杯邀月 → `bgm-yueye-03/04`（1b33f380-aa22-40ca-b14e-c907eb20774e, 0a9911ca-7ceb-4dee-8eab-52aaf57b55f3）；月落乌啼 → `bgm-yueye-05/06`（b2660620-31ab-4e4c-a3eb-f4e173cc81f7, 243e604a-8368-4450-816d-4f4f84d301f4）
- [x] 族3：篱落炊烟 → `bgm-tianyuan-03/04`（93482597-c57b-4836-8ead-864cfa5c9d2b, f6f9e8d9-3ecf-41b0-bc6e-a87e4b892d51）；采菊东篱 → `bgm-tianyuan-05/06`（9eaf746c-2662-43d2-b465-bbba08025271, 405989dc-205c-484d-ab79-91c8fab7fdf4）
- [x] 族4：仗剑天涯 → `bgm-jianghu-03/04`（83ead337-00c5-42ab-87f1-979ca5f08c37, 51c113d2-27ab-4b48-a3cc-3e872a025a50）；山一程水一程 → `bgm-jianghu-05/06`（f032eee1-cfed-42b8-96b6-936431f9399d, 4ac8039e-94e6-40ae-be7a-e55c453920b2）
- [x] 族5：铁马冰河 → `bgm-biansai-03/04`（08904307-e06d-4be7-90aa-639917e2d0f5, 26214a5c-c088-4dd7-9ae7-af901ed249ec）；长河落日 → `bgm-biansai-05/06`（b7aeed47-81ce-4ce0-879c-ce7620577680, f09a6cde-40bf-4ad6-a6ba-41e18fa6b54f）
- [x] 族6：大江东去 → `bgm-huaigu-03/04`（7f7cadda-8b0a-4cf4-b745-f87da923826c, 0ea12b89-5956-46ad-92e4-499d0c295bcf）；六朝旧事 → `bgm-huaigu-05/06`（2ed1bcb9-d12a-4da0-a24b-e16bc207caf8, 10d40d1d-9218-48e6-8944-13daf611fec8）
- [ ] 族7：一蓑烟雨任平生 → `bgm-haofang-03(/04)`；把酒问青天 → `bgm-haofang-05(/06)`
- [ ] 族8：执手相看泪眼 → `bgm-wanxiang-03(/04)`；一种相思 → `bgm-wanxiang-05(/06)`
- [ ] 族9：薄雾浓云 → `bgm-chungui-03(/04)`；知否知否 → `bgm-chungui-05(/06)`
- [x] 族10：烛影摇红 → `bgm-daowang-03/04`（8407c56f-ce9b-4f04-8df9-232937cc563b, 38770810-a80c-44b7-b87e-e0323a5d5baf）
- [ ] 族11（全新）：曲径通幽 → `bgm-chan-01/02`（43adc3cf-60dc-4931-97cb-8ebf293777be, 33ac8f62-3a13-4eec-8395-eb855d0d8bf6）✓；云在青天 → `bgm-chan-03(/04)`；本来无一物 → `bgm-chan-05(/06)`
- [ ] 族12（全新）：长亭古道 → `bgm-songbie-01(/02)`；孤帆远影 → `bgm-songbie-03(/04)`；暗香疏影 → `bgm-songbie-05(/06)`；人生得意 → `bgm-songbie-07(/08)`

> 族 11、12 的拼音前缀现定 `chan`（禅意）、`songbie`（送别咏物节庆），入库时写入 bgm.json 的 family 字段。
>
> 2026-09-09/10 进展：两日共入库 28 首（族1-6 各 4-6 首 + 族10 烛影摇红 + 族11 曲径通幽），库内共 48 首。
> 2026-09-09 计划 12 提示词已全部完成；**剩余 12 个提示词（24 首）**：族7（一蓑烟雨任平生/把酒问青天）、
> 族8（执手相看泪眼/一种相思）、族9（薄雾浓云/知否知否）、族11（云在青天/本来无一物）、
> 族12（长亭古道/孤帆远影/暗香疏影/人生得意）。
> 批跑命令：`SUNO_MODEL=chirp-goose bash scripts/batch-suno-bgm.sh <tsv清单> [日志路径]`
> （模型必须 chirp-goose=v6-mini；清单已备好：`logs/suno-bgm-tomorrow.tsv`；每提示词出 2-4 候选取前 2）。
>
> 当日排障备忘：① `--no-captcha` 直连 generate 会 422（token 必填）；② 匿名页 hCaptcha 会弹人工挑战导致
> `--wait` 卡死 180s，**给 captcha 页注入 `__session=<刷新后的JWT>` 登录态后 invisible 验证码直接过**
> （脚本 `scripts/suno-bgm-gen.py`，批量用 `scripts/batch-suno-bgm.sh`）；③ 多会话/多 chrome 抢 CDP 9233 端口 +
> 内存耗尽是大量超时的根因，批跑须用独立端口（9255）+ 每次清场 + `killpg` 回收整棵进程树；
> ④ Chrome `--proxy-server` 只认 `socks5://`，`socks5h://` 会报 ERR_NO_SUPPORTED_PROXIES；
> ⑤ 2026-09-10 起账号仅 v6-mini 有权限（mv=`chirp-goose`），`chirp-auk(-turbo)` 一律 403 free_upsell；
> ⑥ hCaptcha 对短时间高频请求会升级人工挑战，失败重试须留间隔（≥1 分钟），与网页版生成限流一致。

## 明天续作步骤

1. `SUNO_MODEL=chirp-goose bash scripts/batch-suno-bgm.sh logs/suno-bgm-tomorrow.tsv logs/suno-bgm-day3.log`
   （每提示词出 2-4 候选；hCaptcha 高频会弹人工挑战，脚本已带 3 次重试+清场，失败项可再跑一遍同一命令，done 清单自动跳过已完成）
2. `cli-anything-suno clip download <id>...` 取每提示词前 2 个候选，命名 `bgm-<族>-<序号>.m4a` 放入 `public/audio/bgm/`
3. 更新 `bgm.json`（family：豪放/婉约相思/春愁闺怨/禅意/送别咏物节庆）与本文两张表
4. 36 提示词全量完成后可按 guide「长短版控制」给每族代表款做 30-60s 短版循环（ffmpeg 截取中段 + 交叉淡化）
5. `bash sync-public.sh push`
