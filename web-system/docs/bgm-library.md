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

## 已入库（20 首，2026-09-08）

每族第 1 首的两个候选，clip ID 用于追溯/重新下载：

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

## 未生成（22 首，明天继续）

按 guide 中 style 提示词生成（`--instrumental --wait`，每提示词出 2 候选挑优），入库后在下表打勾并补 clip ID：

- [ ] 族1：远岫孤云 → `bgm-shanshui-03(/04)`；溪山行旅 → `bgm-shanshui-04(/05)`
- [ ] 族2：举杯邀月 → `bgm-yueye-03(/04)`；月落乌啼 → `bgm-yueye-04(/05)`
- [ ] 族3：篱落炊烟 → `bgm-tianyuan-03(/04)`；采菊东篱 → `bgm-tianyuan-04(/05)`
- [ ] 族4：仗剑天涯 → `bgm-jianghu-03(/04)`；山一程水一程 → `bgm-jianghu-04(/05)`
- [ ] 族5：铁马冰河 → `bgm-biansai-03(/04)`；长河落日 → `bgm-biansai-04(/05)`
- [ ] 族6：大江东去 → `bgm-huaigu-03(/04)`；六朝旧事 → `bgm-huaigu-04(/05)`
- [ ] 族7：一蓑烟雨任平生 → `bgm-haofang-03(/04)`；把酒问青天 → `bgm-haofang-04(/05)`
- [ ] 族8：执手相看泪眼 → `bgm-wanxiang-03(/04)`；一种相思 → `bgm-wanxiang-04(/05)`
- [ ] 族9：薄雾浓云 → `bgm-chungui-03(/04)`；知否知否 → `bgm-chungui-04(/05)`
- [ ] 族10：烛影摇红 → `bgm-daowang-03(/04)`
- [ ] 族11（全新）：曲径通幽 → `bgm-chan-01(/02)`；云在青天 → `bgm-chan-02(/03)`；本来无一物 → `bgm-chan-03(/04)`
- [ ] 族12（全新）：长亭古道 → `bgm-songbie-01(/02)`；孤帆远影 → `bgm-songbie-02(/03)`；暗香疏影 → `bgm-songbie-03(/04)`；人生得意 → `bgm-songbie-04(/05)`

> 族 11、12 的拼音前缀现定 `chan`（禅意）、`songbie`（送别咏物节庆），入库时写入 bgm.json 的 family 字段。

## 明天续作步骤

1. `cli-anything-suno clip generate --title "bgm-<族>-<标题>" --tags "<guide 中该首的 style 提示词>" --instrumental --wait`（每首出 2 候选）
2. `cli-anything-suno browse list --limit 100` 按 `metadata.tags` 比对确认归属，抄 clip ID
3. `cli-anything-suno clip download <id> --output <tmp>`，命名 `bgm-<族>-<序号>.m4a` 放入 `public/audio/bgm/`
4. 按验收清单试听打勾，更新本文两张表和 `bgm.json`
5. `bash sync-public.sh push`
