import type { GeneratedPoem, Poem } from '../types';

const API_BASE = (import.meta as unknown as { env: Record<string, string> }).env.VITE_API_BASE || '/api';

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getRandomPoem(): Promise<{ data: { poem: Poem } }> {
  return fetchJson('/poems/random');
}

export async function getPoets(): Promise<{ data: { poets: { name: string; dynasty: string; count: number }[] } }> {
  return fetchJson('/poets');
}

export async function getPoems(poet: string, page = 1, limit = 50): Promise<{ data: { poems: Poem[]; total: number; total_pages: number } }> {
  return fetchJson(`/poems/${encodeURIComponent(poet)}?page=${page}&limit=${limit}`);
}

export async function searchPoems(q: string, page = 1, limit = 24): Promise<{ data: { poems: Poem[]; total: number; total_pages: number } }> {
  return fetchJson(`/search?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`);
}

export async function getPoemById(id: string): Promise<{ data: { poem: Poem } }> {
  return fetchJson(`/poem/${encodeURIComponent(id)}`);
}

export interface LibraryQuery {
  dynasty?: string;
  poet?: string;
  q?: string;
}

/** 诗词库组合筛选：朝代 × 诗人 × 关键词，任意叠加分页 */
export async function getLibrary(params: LibraryQuery & { page?: number; limit?: number } = {}): Promise<{
  data: { poems: Poem[]; total: number; total_pages: number };
}> {
  const sp = new URLSearchParams();
  if (params.dynasty) sp.set('dynasty', params.dynasty);
  if (params.poet) sp.set('poet', params.poet);
  if (params.q) sp.set('q', params.q);
  sp.set('page', String(params.page || 1));
  sp.set('limit', String(params.limit || 24));
  return fetchJson(`/library?${sp.toString()}`);
}

export interface DanmakuItem {
  id: number;
  nickname: string;
  content: string;
  createdAt: number;
}

/** 取某诗弹幕：首次不传 after 取最近 limit 条；之后传 after=nextId 拉增量 */
export async function getDanmaku(
  poemId: string,
  after = 0,
  limit = 100
): Promise<{ data: { items: DanmakuItem[]; nextId: number } }> {
  const q = after > 0 ? `?after=${after}&limit=${limit}` : `?limit=${limit}`;
  return fetchJson(`/poem/${encodeURIComponent(poemId)}/danmaku${q}`);
}

export async function postDanmaku(
  poemId: string,
  body: { nickname: string; content: string }
): Promise<{ data: { item: DanmakuItem } }> {
  const res = await fetch(`${API_BASE}/poem/${encodeURIComponent(poemId)}/danmaku`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || `API error: ${res.status}`);
  return json;
}

export async function getGeneratedPoem(id: string): Promise<GeneratedPoem> {
  return fetchJson(`/generated/${id}`);
}

export interface PoemPlain {
  id: string;
  title: string;
  author: string;
  dynasty: string;
  content: string;
}

/** 取原诗全文：优先已生成包（含全诗 content），否则回退诗词库原诗 */
export async function getPoemText(id: string): Promise<PoemPlain | null> {
  try {
    const g = await getGeneratedPoem(id);
    if (g && g.content) {
      return { id: g.id, title: g.title, author: g.author, dynasty: g.dynasty, content: g.content };
    }
  } catch {
    // fall through
  }
  try {
    const r = await getPoemById(id);
    const p = r?.data?.poem;
    return p ? { id: p.id, title: p.title, author: p.author, dynasty: p.dynasty, content: p.content } : null;
  } catch {
    return null;
  }
}

export interface GeneratedSummary {
  id: string;
  title: string;
  author: string;
  hasArt?: boolean;
  cover?: string;
  line?: string;
  dynasty?: string;
}

export async function getGeneratedIndex(): Promise<{ poems: GeneratedSummary[] }> {
  return fetchJson('/generated');
}
// ── AI 视频生成（逐图×诗句 → 逐段视频，后端 /api/video/:id） ────────
export interface VideoClip {
  id: string;
  prompt?: string;
  image?: string;
  url?: string;
  status: string;
  arkId?: string;
  videoUrl?: string;
  localUrl?: string;
  error?: string;
}

export interface VideoTask {
  status: string;
  stage?: string;
  progress?: number;
  detail?: string;
  error?: string;
  poemId?: string;
  clips?: VideoClip[];
  completedAt?: number;
}

export async function startVideoTask(poemId: string): Promise<{ success: boolean; taskId?: string }> {
  const res = await fetch(`${API_BASE}/video/${encodeURIComponent(poemId)}`, { method: 'POST' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || `API error: ${res.status}`);
  return json as { success: boolean; taskId?: string };
}

export async function getVideoTask(poemId: string): Promise<VideoTask> {
  return fetchJson(`/video/${encodeURIComponent(poemId)}`);
}
