import { fetchBgmTracks, bgmUrl, BGM_VOLUME, matchBgm } from './bgm';
import type { BgmTrack } from './bgm';

const STORAGE_KEY = 'poetry-ambient-bgm';
/** 环境 BGM 音量略低于沉浸页 */
const AMBIENT_VOLUME = BGM_VOLUME * 0.75;

let audio: HTMLAudioElement | null = null;
let tracks: BgmTrack[] | null = null;
let current: BgmTrack | null = null;
let wantPlaying = false;
let enabled: boolean;
try {
  enabled = localStorage.getItem(STORAGE_KEY) !== 'off';
} catch {
  enabled = true;
}

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((fn) => fn());
}

export function subscribeAmbientBgm(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function isAmbientBgmEnabled(): boolean {
  return enabled;
}

export function ambientBgmTitle(): string {
  return current?.title || '';
}

export function toggleAmbientBgm(): void {
  enabled = !enabled;
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // 隐私模式等场景写不进 localStorage，仅影响本次会话
  }
  if (enabled) {
    if (wantPlaying) playCurrent();
  } else {
    audio?.pause();
  }
  notify();
}

async function ensureTracks(): Promise<BgmTrack[]> {
  if (!tracks) tracks = await fetchBgmTracks();
  return tracks;
}

function playCurrent(): void {
  if (!audio || !current) return;
  audio.play().catch(() => {
    // 浏览器自动播放限制：等下一次用户手势时由 AmbientBgm 组件重试
  });
}

/**
 * 启动环境 BGM（单例，跨页面持续）。contextText 存在时按内容匹配曲库，
 * 否则用通用舒缓曲。已在播同一首时不打断。
 */
export async function startAmbientBgm(contextText?: string): Promise<void> {
  if (!enabled) return;
  const list = await ensureTracks();
  if (!list.length) return;
  const pick = contextText
    ? matchBgm(list, contextText)
    : list.find((t) => t.mood.includes('山水')) || list[0];
  if (!pick) return;
  wantPlaying = true;
  if (current?.id === pick.id && audio && !audio.paused) return;
  current = pick;
  if (!audio) {
    audio = new Audio();
    audio.loop = true;
    audio.volume = AMBIENT_VOLUME;
  }
  audio.src = bgmUrl(pick);
  playCurrent();
  notify();
}

/** 暂停环境 BGM（进入沉浸页等自管 BGM 的场景时调用） */
export function pauseAmbientBgm(): void {
  wantPlaying = false;
  audio?.pause();
  notify();
}
