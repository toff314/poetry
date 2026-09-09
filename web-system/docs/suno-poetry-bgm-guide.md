# 诗词朗诵背景音乐：Suno 生成指南

> 目标：为沉浸式诗词页面生成朗诵配乐。两种方案：
> - **方案 A（推荐）**：只生成纯背景音乐（instrumental），在页面里用 Web Audio 与朗诵音轨混音。
> - **方案 B（备选）**：Suno 直接生成「配乐 + 朗诵」一体音频（spoken word，只念不唱）。
>
> 本文只提供提示词与操作方法，先在 Suno 网页（suno.com）测试，确认效果后再落到 CLI 代码。

---

## 方案 A：纯背景音乐（Instrumental）

### 网页操作

1. 打开 suno.com → **Create** → 切换到 **Custom** 模式。
2. 打开 **Instrumental** 开关（关键：打开后不填歌词，只填 Style of Music）。
3. 在 *Style of Music* 粘贴下面任一风格提示词。
4. 生成 2-4 段，挑无人声哼唱、起伏平缓的一段。

### CLI 等价命令（网页测试通过后使用）

```bash
cli-anything-suno clip generate \
  --title "poem-bgm-landscape" \
  --tags "<style提示词>" \
  --instrumental \
  --wait
# 然后 download；instrumental 无歌词，跳过 lrc 步骤
```

### Style 提示词模板（按诗词情感分类）

Suno 对**英文 style 标签**响应最稳定，逗号分隔，**顺序即优先级**（第一个词权重最高）。每套都可直接用，也可替换乐器/情绪词微调。

**A1. 通用山水 / 静谧月夜**（王维、孟浩然、静夜思类）

```
Chinese ambient, peaceful, guzheng, dizi bamboo flute, soft piano, warm strings, slow tempo, 60-70 BPM, cinematic reverb, no vocals
```

**A2. 田园闲适 / 清新**（过故人庄、饮酒类）

```
Chinese folk ambient, gentle, guzheng, xiao flute, light plucked strings, countryside atmosphere, peaceful, slow, 66-72 BPM, no vocals
```

**A3. 边塞豪放 / 历史怀古**（出塞、念奴娇、永遇乐类）

```
Cinematic Chinese epic, heroic, erhu, taiko drums, low brass, majestic strings, tension and release, steady, 90-100 BPM, no vocals
```

**A4. 婉约相思 / 凄美**（李清照、柳永、雨霖铃类）

```
Melancholic Chinese ballad, emotional, piano, erhu, solo cello, soft rain atmosphere, intimate, very slow, 58-66 BPM, no vocals
```

**A5. 禅意 / 空灵**（禅诗、山水小品）

```
Meditative Chinese ambient, mysterious, sparse guzheng notes, deep warm drone, distant hand bells, night atmosphere, minimal, very slow, 50-60 BPM, no vocals
```

> 提示：想要「有人声厚度但不抢戏」，可在 A3/A4 末尾加 `wordless choir hum`（无词哼唱），测试后决定是否保留。

---

## 方案 A 模板库：36 首预生成 BGM（推荐路线）

> 思路：像 PPT 模板一样，一次性批量生成 + 人工挑优入库（每次生成出 2 首，通常都能用），诗按情绪标签匹配模板，程序侧轮换去重。长版负责「整首沉浸」，短版负责「无缝循环/快速浏览」。
>
> **生成规则**：每个提示词跑一次 = 出 2 首，36 个提示词 = 72 首候选，人工挑 ~36 首入库（同族保留不同气质）。全部为 Instrumental（打开 Instrumental 开关，不填歌词）。命名规范 `bgm-<族>-<序号>`。

### 族 1：山水（3）

| 标题 | Style 提示词 |
|---|---|
| 空山新雨 | `Chinese ambient, peaceful, guzheng, bamboo dizi, soft rain atmosphere, fresh after rain, slow, 60-70 BPM, no vocals` |
| 远岫孤云 | `Chinese ambient, spacious, sparse guzheng notes, warm drone, misty mountains, minimal, 55-65 BPM, no vocals` |
| 溪山行旅 | `Chinese folk, flowing water feel, light plucked strings, walking tempo, carefree, 72-80 BPM, no vocals` |

### 族 2：月夜（3）

| 标题 | Style 提示词 |
|---|---|
| 床前月明 | `Minimalist Chinese piano, soft moonlight, intimate, very slow, 50-60 BPM, no vocals` |
| 举杯邀月 | `Elegant guzheng, night atmosphere, wistful, light strings, 62-70 BPM, no vocals` |
| 月落乌啼 | `Dark Chinese ambient, sparse piano, low drone, melancholic night, 55-62 BPM, no vocals` |

### 族 3：田园（3）

| 标题 | Style 提示词 |
|---|---|
| 稻花乡里 | `Chinese folk ambient, guzheng, xiao flute, birdsong, cheerful and gentle, countryside, 66-74 BPM, no vocals` |
| 篱落炊烟 | `Warm Chinese pastoral, acoustic plucked strings, cozy village dusk, relaxed, 70-78 BPM, no vocals` |
| 采菊东篱 | `Meditative Chinese folk, soft dizi flute, laid-back, contented, 60-68 BPM, no vocals` |

### 族 4：行旅江湖（3）

| 标题 | Style 提示词 |
|---|---|
| 孤舟蓑笠 | `Flowing Chinese ambient, erhu, river water atmosphere, drifting solitude, 68-76 BPM, no vocals` |
| 仗剑天涯 | `Wuxia style, guzheng strumming, dizi, adventurous, mid tempo, 82-92 BPM, no vocals` |
| 山一程水一程 | `Steady walking beat, plucked strings with strings, journey feel, 76-86 BPM, no vocals` |

### 族 5：边塞（3）

| 标题 | Style 提示词 |
|---|---|
| 大漠孤烟 | `Cinematic Chinese epic, vast desert, taiko drums, low brass, erhu, 85-95 BPM, no vocals` |
| 铁马冰河 | `War drums, heroic cold strings, frontier tension, steady march, 95-105 BPM, no vocals` |
| 长河落日 | `Epic Chinese ambient, deep drones, horse-hoof rhythm, majestic sunset, 75-85 BPM, no vocals` |

### 族 6：怀古（3）

| 标题 | Style 提示词 |
|---|---|
| 故国不堪回首 | `Melancholic Chinese, piano and erhu, memory and loss, restrained, 58-66 BPM, no vocals` |
| 大江东去 | `Grand cinematic guzheng with orchestra, historical sweep, uplifting sorrow, 80-90 BPM, no vocals` |
| 六朝旧事 | `Subdued Chinese ambient, distant bells, aged strings, antiquity, 60-70 BPM, no vocals` |

### 族 7：豪放（3）

| 标题 | Style 提示词 |
|---|---|
| 老夫聊发少年狂 | `Powerful Chinese, drums and erhu, confident and bold, 92-100 BPM, no vocals` |
| 一蓑烟雨任平生 | `Open-hearted guzheng, resilient, mid tempo, rain atmosphere, 80-90 BPM, no vocals` |
| 把酒问青天 | `Bold Chinese, brass and drums, heroic celebration, 90-100 BPM, no vocals` |

### 族 8：婉约相思（3）

| 标题 | Style 提示词 |
|---|---|
| 才下眉头 | `Tender Chinese, piano and erhu, quiet longing, intimate, 62-70 BPM, no vocals` |
| 执手相看泪眼 | `Emotional Chinese strings, farewell tenderness, tearful restraint, 60-68 BPM, no vocals` |
| 一种相思 | `Gentle guzheng ballad instrumental, soft longing, warm, 66-74 BPM, no vocals` |

### 族 9：春愁闺怨（3）

| 标题 | Style 提示词 |
|---|---|
| 雨打梨花 | `Deep night rain, sparse piano, delicate sorrow, 55-62 BPM, no vocals` |
| 薄雾浓云 | `Hazy Chinese ambient, gentle oppressive sadness, slow, 58-66 BPM, no vocals` |
| 知否知否 | `Light plucked strings, wistful spring mood, 70-78 BPM, no vocals` |

### 族 10：悼亡哀思（2）

| 标题 | Style 提示词 |
|---|---|
| 十年生死 | `Mournful Chinese, solo cello and erhu, very sparse, deep grief, 52-60 BPM, no vocals` |
| 烛影摇红 | `Still ambient piano, candle-like warmth and loss, minimal, 50-58 BPM, no vocals` |

### 族 11：禅意（3）

| 标题 | Style 提示词 |
|---|---|
| 曲径通幽 | `Meditative Chinese ambient, deep drone, distant hand bells, minimal, 50-60 BPM, no vocals` |
| 云在青天 | `Zen ambient, sparse guzheng, water-like spaciousness, 55-65 BPM, no vocals` |
| 本来无一物 | `Pure drone with soft temple bell, very sparse, breath-like silence, 45-55 BPM, no vocals` |

### 族 12：送别咏物节庆（4）

| 标题 | Style 提示词 |
|---|---|
| 长亭古道 | `Chinese folk, xiao flute, farewell on an old road, 66-74 BPM, no vocals` |
| 孤帆远影 | `Flowing strings, open sky, parting across water, 70-78 BPM, no vocals` |
| 暗香疏影 | `Delicate plucked strings with wind, cold plum blossom, 60-70 BPM, no vocals` |
| 人生得意 | `Festive Chinese drums and plucked strings, joyful triumph, 96-104 BPM, no vocals` |

### 长短版控制

Suno 不吃「生成 X 秒」这类指令，长短版用这两个办法：

- **长版（默认，~2 分钟）**：正常生成，适合单诗沉浸页整首播放。给 style 末尾加 `short intro, steady structure` 减少前奏、让主体结构早进入，方便程序从任意诗的中途接入。
- **短版（循环 loop，30-60 秒）**：两条路任选——
  1. 网页端用 **Clip** 模式（可选 15/30/60 秒）对入库的长版再生成短版，style 末尾加 `loop-friendly, consistent dynamics`；
  2. 更省钱：长版下载后用 ffmpeg 截取中段最平稳的 30-60 秒做无缝循环（`-af afade` 首尾微淡入淡出），程序侧 Web Audio `loop=true` + 交叉淡化即可。
  建议只给每族的「代表款」做短版（约 12-15 首），不全量做。

### 程序筛选元数据

每首入库模板登记一条记录，程序按字段筛选/轮换：

```json
{ "id": "bgm-yueye-01", "title": "床前月明", "mood": "月夜", "bpm": 55, "energy": 1, "duration": 118, "hasShortLoop": true }
```

- `mood` 对上 `tags.json` 的诗情感标签（建立 mood → template_ids[] 映射）；
- `energy` 1-5 手动标，辅助「同族内按诗的情绪强度挑」；
- 播放侧记住本 session 播过的 id，轮换时优先选没播过的，避免连续重复。

### 验收标准（批量生成时过一遍）

- [ ] 全程无哼唱、无说话声
- [ ] 前奏 ≤ 10 秒，主体进入快
- [ ] 情绪与该族定义吻合（入库时按族试听对比，剔除跑偏的）
- [ ] 同族 2-3 首之间气质有区分（不要三首听起来一样）

CLI 批量生成（每首跑一次出 2 个候选，循环跑完 36 个提示词）：

```bash
cli-anything-suno clip generate \
  --title "bgm-yueye-01-床前月明" \
  --tags "Minimalist Chinese piano, soft moonlight, intimate, very slow, 50-60 BPM, short intro, steady structure, no vocals" \
  --instrumental \
  --wait
# 每族挑优后存入 web-system/public/audio/bgm/
```

---

## 方案 B：配乐 + 朗诵一体（只念不唱）

Suno 的 Instrumental 开关不能「只出音调 + 让位给人念」，想让它念诗，必须走 Custom 模式同时给 Style 和 Lyrics，用提示词强压「说、不要唱」。

### 网页操作

1. Create → **Custom**，**关闭** Instrumental 开关。
2. *Style of Music* 填：

```
spoken word narration, do not sing, Mandarin Chinese, clear diction, calm and steady recitation, gentle background music, guzheng and soft strings, slow, 65-75 BPM
```

3. *Lyrics* 填结构化歌词（见下方模板），生成后检查：如果还是唱起来了，把 style 里的 `do not sing` 换成 `spoken word, narration only, no melody singing` 再生成，或多抽几段。

### 歌词模板（以《静夜思》为例）

结构标签用英文方括号；**行尾不加标点**；每段 4-8 行；段与段之间空一行。

```
[Intro]
(instrumental, guzheng and soft strings)

[Spoken]
床前明月光
疑是地上霜
举头望明月
低头思故乡

[Interlude]
(piano solo, emotional)

[Spoken]
(softly, slowly)
床前明月光
疑是地上霜

[Outro][fade out][end]
```

要点：

- `[Spoken]` 是 Suno 的「念白/旁白」标签，是压唱的核心手段；段首可加 `(softly, slowly)` 等表演提示。
- `[Intro]` / `[Interlude]` 用括号写 `(instrumental, ...)` 表示纯乐器过门，给朗诵留气口。
- 结尾必须 `[Outro][fade out][end]` 三连，否则 AI 容易无限续尾；还停不住就重复 `[fade out][fade out][fade out]`。
- 单段词别超过 8 行，一首绝句刚好一段；律诗/长调拆成多个 `[Spoken]` 段，中间用 `[Interlude]` 隔开。
- 想在长诗后面续时长，用网页的 **Extend** 或 CLI 追加生成，续段不要重复已中断的标签（视作新段落继续写即可）。

### 《虞美人》（李煜）完整示例 — v1 吟唱版（已实测，效果好，保留）

> 这一版虽然 AI 唱了起来，但「依词吟唱」效果本身出彩，可作为**古诗词歌曲**路线保留（页面可提供「吟唱 / 纯 BGM」两种音频）。若目标是严格「只念不唱」，用下面的 v2。

Style of Music：

```
spoken word narration, do not sing, Mandarin Chinese, clear diction, sorrowful and restrained recitation, gentle background music, erhu and soft piano, slow, 60-70 BPM
```

Lyrics（上片 4 句 + 过门 + 下片 4 句，结构正好像一首词的上下阕）：

```
[Intro]
(instrumental, erhu and soft piano, melancholic)

[Spoken]
(slowly, sorrowful)
春花秋月何时了
往事知多少
小楼昨夜又东风
故国不堪回首月明中

[Interlude]
(piano solo, emotional)

[Spoken]
(gently, with grief)
雕栏玉砌应犹在
只是朱颜改
问君能有几多愁
恰似一江春水向东流

[Outro][fade out][end]
```

### 《虞美人》（李煜）完整示例 — v2 强化念白版

> 若 v1 的吟唱不是你要的效果（严格只念不唱），用这版。v1 总是唱起来的原因：style 里 `gentle background music, erhu and soft piano` 给了 AI 太多「抒情歌曲」信号，诗词押韵本身就强化演唱倾向。v2 按网上成功案例（Reddit / Jack Righteous 攻略 / Suno Wiki）改为「纪录片旁白」写法：**正面指令（voiceover/narration）堆足，去掉一切「歌曲感」词汇**。旧版 Suno 有 Exclude Styles 字段可放否定词，当前网页 UI 已无此字段，否定需求只能靠正面指令压 + 多抽几段。

Style of Music（全正面指令，无否定词）：

```
spoken word narration, treat all text as voiceover, natural speech cadence, Mandarin Chinese, mature warm narrator voice, minimal documentary underscore, sparse erhu and soft piano, voice-forward mix, low dynamics, 60-70 BPM
```

Lyrics（标签从 `[Spoken]` 换成 `[Spoken narration]`，据 Suno Wiki / suno4.cn 实测比 `[Spoken]` 命中率高；也可用 `[朗诵]`）：

```
[Intro]
(instrumental, sparse piano notes)

[Spoken narration]
(slow, sorrowful)
春花秋月何时了
往事知多少
小楼昨夜又东风
故国不堪回首月明中

[Interlude]
(erhu solo, quiet)

[Spoken narration]
(gently, with grief)
雕栏玉砌应犹在
只是朱颜改
问君能有几多愁
恰似一江春水向东流

[Outro][fade out][end]
```

### 《虞美人》（李煜）— v3 括号念白版（v2 仍在唱时用这版）

> v2 全部用裸诗句行，行式排列本身就像歌词。v3 引入社区实测有效的两个新手段（suno4.cn + Reddit）：
> 1. **诗句整体包进英文括号 `()`**——Suno 把括号内容当「旁白/舞台提示」处理，触发朗读而非演唱；
> 2. **`[spoken intro]`**——Reddit 实测能让它开口就念、不等前奏；
> 3. **双重标注**——`[朗诵]` + 括号同时用，比单一手段命中率高（suno4.cn 明确建议混合标注）。
> 括号内是「说出来的话」，所以恢复标点断句（逗号句号）反而帮助它按口语节奏念——这与唱歌时的「行尾不加标点」规则相反。

Style of Music（同 v2，不变）：

```
spoken word narration, treat all text as voiceover, natural speech cadence, Mandarin Chinese, mature warm narrator voice, minimal documentary underscore, sparse erhu and soft piano, voice-forward mix, low dynamics, 60-70 BPM
```

Lyrics：

```
[spoken intro]
(slow, sorrowful)
(春花秋月何时了，往事知多少。)
(小楼昨夜又东风，故国不堪回首月明中。)

[Interlude]
(erhu solo, quiet)

[朗诵]
(gently, with grief)
(雕栏玉砌应犹在，只是朱颜改。)
(问君能有几多愁，恰似一江春水向东流。)

[Outro][fade out][end]
```

注意：

- 括号内标点用中文逗号句号即可——这是给「说话」断句用的，与唱歌规则不冲突；但括号本身必须是英文 `()`。
- 一个括号装一联（两句），别拆成单句多个括号，否则气口太碎。
- 这版仍不是 100%（Suno 本质是音乐生成器），一次生成 4 段挑最「念」的；如果 v3 还是唱，按下面排查表最后一行走保底方案。

v2/v3 通用注意：

- 词的上下片之间用 `[Interlude]` 留气口，过门处配乐抬升，模拟「换头」的呼吸感。
- 李煜词情绪是「哀而不号」，style 用 `sorrowful and restrained`（哀而不扬），别加 `powerful/epic`，否则 AI 容易往唱的方向跑。
- 结尾两句是全词情绪最高点，段前提示用 `(gently, with grief)` 引导收着念，而不是放开。
- **诗词天然押韵 = 强演唱信号**（Reddit / Jack Righteous 攻略的共同结论）。文案没法去韵，能做的是：风格整体压成「纪录片旁白」、配乐极简（`minimal underscore, voice-forward mix`）、给每行断句留空间。如果还是唱，按下表排查：

| 症状 | 原因 | 对策 |
|---|---|---|
| 全程在唱 | style 描述得像一首抒情歌 | 删掉 `ballad/song/gentle background music` 类词，换成 `documentary underscore, voice-forward` |
| 越到结尾越像唱 | 押韵 + 情绪推进触发旋律 | 结尾段前加 `(flat, restrained delivery)`；配乐保持稀疏 |
| 出现哼唱 | AI 自动补人声 | style 尾追加 `minimal melodic content`，多抽几段 |
| 只有一两句唱 | 局部句子节奏感太强 | 网页端用 **Song Editor** 框选那几句 → Replace，提示词只写 `calm spoken narration` 重生成该区段，不用整首重来 |
| 成功率仍低 | 模型倾向 | 保底方案：用已成功的**纯 BGM（方案 A）+ 单独 TTS 朗诵**混音，或先用 Suno 生成一段合格念白后存为 **Persona**，之后复用这个声线 |

- 网页端实操要点：当前 UI 没有 Exclude Styles 字段，**Style 里尽量少用 "no/不要" 这类否定词**（Suno 对否定词经常视而不见，知乎手册、Reddit 均验证），靠正面指令（`voiceover, narration, voice-forward, documentary underscore`）堆权重 + 一次生成 4 段挑最「念」的一版。

### 长诗示例骨架（律诗/词通用）

```
[Intro]
(instrumental, erhu and soft piano)

[Spoken]
(前四句)

[Interlude]
(piano solo)

[Spoken]
(后四句)

[Outro][fade out][end]
```

### CLI 等价命令（测试通过后）

```bash
cli-anything-suno clip generate \
  --title "poem-recite-jingyesi" \
  --tags "spoken word narration, do not sing, Mandarin Chinese, clear diction, gentle background music, guzheng and soft strings, slow, 65-75 BPM" \
  --lyrics-file ./recite-lyrics.txt \
  --wait
# 有歌词则照常执行 clip lrc 生成 LRC；若用于纯音频播放可跳过

# 《虞美人》v1 吟唱版
cli-anything-suno clip generate \
  --title "poem-recite-yumeiren" \
  --tags "spoken word narration, do not sing, Mandarin Chinese, clear diction, sorrowful and restrained recitation, gentle background music, erhu and soft piano, slow, 60-70 BPM" \
  --lyrics-file ./recite-yumeiren.txt \
  --wait

# 《虞美人》v2 强化念白版
cli-anything-suno clip generate \
  --title "poem-recite-yumeiren-v2" \
  --tags "spoken word narration, treat all text as voiceover, natural speech cadence, Mandarin Chinese, mature warm narrator voice, minimal documentary underscore, sparse erhu and soft piano, voice-forward mix, low dynamics, 60-70 BPM" \
  --lyrics-file ./recite-yumeiren-v2.txt \
  --wait

# 《虞美人》v3 括号念白版
cli-anything-suno clip generate \
  --title "poem-recite-yumeiren-v3" \
  --tags "spoken word narration, treat all text as voiceover, natural speech cadence, Mandarin Chinese, mature warm narrator voice, minimal documentary underscore, sparse erhu and soft piano, voice-forward mix, low dynamics, 60-70 BPM" \
  --lyrics-file ./recite-yumeiren-v3.txt \
  --wait
```

---

## 提示词规则速查（避坑清单）

| 规则 | 原因 |
|---|---|
| style 用英文逗号分隔，首词权重最高 | 顺序即优先级，`Chinese ambient, peaceful` ≠ `peaceful, Chinese ambient` |
| 禁止真实艺人名（如"周杰伦风格"） | 会被拒或跑偏，用 `Mandopop, male voice` 这类描述 |
| 歌词行尾不加任何标点 | 行尾逗号/句号会让 AI 跳过或拖拍 |
| 结构符号只用英文 `[]` `()` `,` | 中文 `【】（）` 会被当作歌词唱出来 |
| `[Break]` 之后必须紧跟唱段 | 长停顿后 AI 会换一个声线 |
| 想精确控速就写 `XX-XX BPM` | 比 `slow/fast` 稳定 |
| 第一段内容别贪多 | 内容过多 AI 会赶拍；不够再 Extend |
| 方案 B 多抽几段 | 「只念不唱」成功率不是 100%，生成 4 段通常能挑出合格的 |

---

## 验收标准（网页试听检查单）

**方案 A（纯 BGM）：**
- [ ] 全程无哼唱、无说话声
- [ ] 鼓点/重拍不密集，不会盖过朗诵节奏
- [ ] 情绪与诗的分类匹配（豪放的要有推进感，婉约的要收着）
- [ ] 结尾自然衰减（fade out），方便循环衔接
- [ ] 时长 ≥ 朗诵预计时长（不够就 Extend 或选 A3 这类结构感强的）

**方案 B（一体朗诵）：**
- [ ] 是「念」不是「唱」，语调平直有古韵
- [ ] 咬字清晰（clear diction 生效）
- [ ] 配乐音量低于人声，过门处配乐抬起来
- [ ] 每句诗之间留有气口，不赶

---

## 测试通过后改代码的落点

1. 生成产物命名：`web-system/public/audio/<poem-id>-bgm.mp3`（方案 A）或 `<poem-id>-recite.mp3`（方案 B）。
2. 方案 A 混音参考：Web Audio 两条 `MediaElementSource` / `AudioBufferSource`，BGM `GainNode` 设 0.15~0.25，朗诵 1.0，BGM 循环播放（`loop = true`）。
3. 页面默认值：优先方案 A（可换 TTS 真人声、可独立调音量）；方案 B 作为一键成品兜底。
4. CLI 下载后用 `ls -la` 确认非空，再进页面联调。
