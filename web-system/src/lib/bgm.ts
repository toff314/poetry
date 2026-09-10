export interface BgmTrack {
  id: string;
  /** 音频文件名（含扩展名，mp3/m4a 均可）；缺省用 <id>.mp3 */
  file?: string;
  title: string;
  /** 族（山水/月夜/…），见 docs/bgm-library.md */
  family?: string;
  instrument?: string;
  mood: string[];
  tempo?: string;
}

const BGM_JSON_URL = '/audio/bgm/bgm.json';
export const BGM_BASE = '/audio/bgm';
export const BGM_VOLUME = 0.16;

/** 情绪词典：正则 → 命中的情绪标签权重（用于文本启发式匹配） */
const MOOD_LEXICON: { re: RegExp; score: Record<string, number> }[] = [
  {
    // 边塞
    re: /塞|胡|沙场|烽火|金戈|铁马|冰河|大漠|孤烟|长河落日|羌|征|鼙鼓|旌旗|孤城|边声|玉门关|阳关|楼兰|角声/,
    score: { 边塞: 3, 苍凉: 1, 辽阔: 1, 激昂: 1 },
  },
  {
    // 豪放
    re: /黄河|长江|大江|江海|万里|千山|千杯|三百杯|将进酒|狂|长风|挽弓|射虎|老夫|少年狂|青天|烟雨任平生|何妨|吟啸|绝顶|览众山|浪淘/,
    score: { 豪放: 2, 激昂: 2, 豪迈: 2, 壮阔: 1 },
  },
  {
    // 苍凉 / 辽阔（泛用）
    re: /剑|刀|战|白发|万古|苍茫|浮云|今宵|云外|天际|悠悠/,
    score: { 苍凉: 1, 辽阔: 1, 激昂: 1 },
  },
  {
    // 悼亡
    re: /悼亡|生死|孤坟|坟|墓|祭奠|十年生死|泪湿|夜来幽梦|松冈|白发送黑发/,
    score: { 悼亡: 3, 哀思: 2 },
  },
  {
    // 春愁闺怨
    re: /闺|眉|梨花|薄雾|浓云|绿肥红瘦|伤春|春暮|残红|慵|阑干/,
    score: { 春愁: 2, 婉约: 1, 哀思: 1 },
  },
  {
    // 怀古
    re: /故国|六朝|怀古|古迹|旧都|金陵|铜雀|台城|吴宫|千古|东逝水|赤壁|南朝/,
    score: { 怀古: 3, 苍凉: 1, 哀思: 1, 悠远: 1 },
  },
  {
    // 禅意
    re: /禅|空门|菩提|寺|钟声|僧|悟道|曲径|本来无一物|涅槃|入定|莲台|般若/,
    score: { 禅意: 3, 空灵: 2, 静谧: 1 },
  },
  {
    // 田园
    re: /田园|稻花|桑麻|东篱|菊花|采菊|牧童|炊烟|篱落|耕种|樵|渔歌|鸡鸣|犬吠|闲居|隐居|田夫|蚕|村落|柴门|把酒话/,
    score: { 田园: 3, 清新: 2, 闲适: 2 },
  },
  {
    // 行旅江湖
    re: /孤舟|蓑笠|行旅|天涯|江湖|渡口|客路|羁旅|孤帆|山一程|水一程|游子|客心|驿站|扁舟|行路难/,
    score: { 行旅: 2, 苍凉: 1, 辽阔: 1, 悠远: 1 },
  },
  {
    // 送别
    re: /送别|长亭|歧路|折柳|挥手|离歌|饯行|南浦|故人西辞|西出阳关|离别/,
    score: { 送别: 2, 苍凉: 1, 婉约: 1, 哀思: 1 },
  },
  {
    // 月夜
    re: /明月|月落|乌啼|月白|月光|望月|邀月|静夜|婵娟|蟾宫|月明|月色/,
    score: { 月夜: 2, 静谧: 1, 婉约: 1 },
  },
  {
    // 相思
    re: /相思|忆君|怀人|锦书|青鸟|红豆|连理|倚栏|凭栏|望君|君归|断肠|憔/,
    score: { 相思: 2, 婉约: 1, 哀思: 1 },
  },
  {
    // 婉约 / 清雅 / 静谧
    re: /花|雨|梦|思|泪|楼|灯|庭院|无言|黄昏|杨柳|烟|落花|残|孤|空|小桥|春水|燕子|帘|烛|酒醒|别|离|深|细|轻|浅|红|绿|翠/,
    score: { 婉约: 2, 清雅: 1, 静谧: 1, 悠远: 1 },
  },
  {
    // 山水
    re: /空山|新雨|云雾|远山|岫|溪|山泉|瀑布|幽谷|竹林|清泉|鸟鸣涧|松下|岩|峰|幽人/,
    score: { 山水: 2, 清雅: 2, 静谧: 1 },
  },
];

export async function fetchBgmTracks(): Promise<BgmTrack[]> {
  try {
    const res = await fetch(BGM_JSON_URL);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.tracks) ? data.tracks : [];
  } catch {
    return [];
  }
}

export function bgmUrl(track: BgmTrack): string {
  return `${BGM_BASE}/${track.file || `${track.id}.mp3`}`;
}

/**
 * 泛情绪标签（多族共享）vs 族特征标签（如 山水/月夜/边塞）。
 * 选曲分两级：先看族特征标签命中（d），命中相同再比泛标签（g），
 * 避免「花/雨/梦/月」等高频词把所有诗都堆到月夜/山水这类泛标签多的曲目。
 * 完全没有族特征信号时整库散列打散，不再集中兜底到少数几首。
 */
const GENERIC_MOODS = new Set(['静谧', '清雅', '婉约', '哀思', '悠远', '苍凉', '辽阔', '激昂', '豪迈', '壮阔', '闲适', '清新', '空灵']);

function moodOverlap(moods: string[], scores: Record<string, number>): { d: number; g: number } {
  let d = 0;
  let g = 0;
  for (const m of moods) {
    const s = scores[m] || 0;
    if (!s) continue;
    if (GENERIC_MOODS.has(m)) g += Math.min(s, 1);
    else d += s;
  }
  return { d, g };
}

/** djb2 散列：同一文本稳定得到同一候选（同族多曲时间换空间式轮换） */
function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * 按诗文文本匹配度排序全部曲目（降序，同分按文本散列稳定打散）。
 * 放映厅据此在 Top 候选里按已用次数挑曲，避免同一场重复同一文件。
 */
export function rankBgm(tracks: BgmTrack[], text: string): BgmTrack[] {
  if (!tracks.length) return [];
  const scores: Record<string, number> = {};
  for (const { re, score } of MOOD_LEXICON) {
    if (!re.test(text)) continue;
    for (const [mood, w] of Object.entries(score)) {
      scores[mood] = (scores[mood] || 0) + w;
    }
  }
  const overlaps = tracks.map((t) => moodOverlap(t.mood, scores));
  const bestD = Math.max(...overlaps.map((o) => o.d));
  let pool: BgmTrack[];
  if (bestD > 0) {
    const candidates = tracks.filter((_, i) => overlaps[i].d === bestD);
    const bestG = Math.max(...candidates.map((t) => overlaps[tracks.indexOf(t)].g));
    pool = candidates.filter((t) => overlaps[tracks.indexOf(t)].g === bestG);
  } else {
    // 无族特征信号：全库按文本散列打散，避免集中兜底到同一族
    pool = tracks.slice();
  }
  const h = hashStr(text || tracks[0].id);
  return pool
    .map((t, i) => ({ t, k: (h + i * 2654435761) >>> 0 }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.t);
}

/**
 * 根据诗文文本启发式选出最贴合的曲目：族特征标签优先、泛情绪标签次之，
 * 同分时用文本散列在候选间稳定挑选（同诗同曲、异诗打散）；
 * 无任何特征信号时整库散列，不集中兜底到单一族。
 */
export function matchBgm(tracks: BgmTrack[], text: string): BgmTrack | null {
  return rankBgm(tracks, text)[0] || null;
}
