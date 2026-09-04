export interface BgmTrack {
  id: string;
  title: string;
  instrument: string;
  mood: string[];
  tempo: string;
}

const BGM_JSON_URL = '/audio/bgm/bgm.json';
export const BGM_BASE = '/audio/bgm';
export const BGM_VOLUME = 0.16;

/** 情绪词典：正则 → 命中的情绪标签权重（用于文本启发式匹配） */
const MOOD_LEXICON: { re: RegExp; score: Record<string, number> }[] = [
  {
    // 豪放 / 苍凉 / 壮阔
    re: /黄河|长江|江海|大江|万里|千山|剑|刀|千杯|三百杯|将进酒|醉|塞|胡|沙场|烽火|金戈|铁马|狂|愁|苍|孤城|边|羌|征|战|云外|天际|长风|飞|龙|虎|马|今宵|浮云|苍茫|白发|万古/,
    score: { 激昂: 2, 壮阔: 2, 豪迈: 2, 苍凉: 1, 辽阔: 1 },
  },
  {
    // 婉约 / 清雅 / 静谧
    re: /花|雨|梦|思|泪|楼|灯|庭院|眉|无言|黄昏|杨柳|烟|落花|残|孤|空|月明|小桥|春水|燕子|帘|烛|酒醒|别|离|深|细|轻|浅|红|绿|翠/,
    score: { 婉约: 2, 清雅: 1, 静谧: 1, 悠远: 1 },
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
  return `${BGM_BASE}/${track.id}.mp3`;
}

/**
 * 根据诗文文本启发式选出最贴合的曲目；无命中返回第一首清雅曲（或 null）。
 * 未来 poem 数据带 mood 标签时可改为优先取标签。
 */
export function matchBgm(tracks: BgmTrack[], text: string): BgmTrack | null {
  if (!tracks.length) return null;
  const scores: Record<string, number> = {};
  for (const { re, score } of MOOD_LEXICON) {
    if (!re.test(text)) continue;
    for (const [mood, w] of Object.entries(score)) {
      scores[mood] = (scores[mood] || 0) + w;
    }
  }
  const topMood = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!topMood) {
    // 兜底：优先清雅类舒缓曲
    return (
      tracks.find((t) => t.mood.includes('清雅')) ||
      tracks[0]
    );
  }
  return (
    tracks.find((t) => t.mood.includes(topMood)) ||
    tracks.slice().sort((a, b) => moodOverlap(b.mood, scores) - moodOverlap(a.mood, scores))[0] ||
    tracks[0]
  );
}

function moodOverlap(moods: string[], scores: Record<string, number>): number {
  return moods.reduce((sum, m) => sum + (scores[m] || 0), 0);
}
