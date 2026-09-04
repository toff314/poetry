#!/usr/bin/env node
/**
 * generate-video.mjs — 为某首诗的沉浸页逐画面生成短视频（火山方舟 Ark · Seedance）
 *
 * 用法: node scripts/generate-video.mjs <poemId> [--task <taskId>]
 *
 * 思路: 「几个图片就生成几个视频，提示词只用诗句」
 *   每张图（hero / scene-N）对应一段诗句（定场句 / 该段原文），
 *   各自提交一个 Ark 内容生成任务 → 轮询 → 完成后下载 mp4 到 public/videos/<poemId>/。
 *
 * 前置: .env 需有 ARK_API_KEY（火山方舟 key）与 PUBLIC_ASSET_BASE（图片公网基址，
 *       形如 https://your.site —— 图片必须可被火山侧公网拉取）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data', 'generated');
const TASK_DIR = path.join(ROOT, 'data', 'videos');
const PUB_VIDEO = path.join(ROOT, 'public', 'videos');

const rawId = process.argv[2];
const taskId = process.argv[process.argv.indexOf('--task') + 1] || rawId;
if (!rawId) {
  console.error('用法: node scripts/generate-video.mjs <poemId> [--task <taskId>]');
  process.exit(1);
}

const ARK_URL = 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks';
const MODEL = process.env.ARK_MODEL || 'doubao-seedance-2-0-mini-260615';
const RATIO = process.env.VIDEO_RATIO || '16:9';
const DURATION = Number(process.env.VIDEO_DURATION || 11);
const GENERATE_AUDIO = String(process.env.VIDEO_AUDIO ?? 'true') === 'true';
const WATERMARK = String(process.env.VIDEO_WATERMARK ?? 'false') === 'true';
const KEY = process.env.ARK_API_KEY || '';
const ASSET_BASE = String(process.env.PUBLIC_ASSET_BASE || '').replace(/\/$/, '');

fs.mkdirSync(TASK_DIR, { recursive: true });
fs.mkdirSync(PUB_VIDEO, { recursive: true });

const taskFile = path.join(TASK_DIR, `${taskId}.json`);
function loadTask() {
  return fs.existsSync(taskFile) ? JSON.parse(fs.readFileSync(taskFile, 'utf-8')) : null;
}
function savePatch(patch) {
  const cur = loadTask() || {};
  fs.writeFileSync(taskFile, JSON.stringify({ ...cur, ...patch }, null, 2));
}
function fail(msg) {
  savePatch({ status: 'error', error: msg, detail: msg });
  console.error('✗', msg);
  process.exit(1);
}
function progress() {
  const t = loadTask() || {};
  const clips = t.clips || [];
  const doneN = clips.filter((c) => c.status === 'done').length;
  const ok = clips.length ? Math.round((doneN / clips.length) * 100) : 0;
  savePatch({ progress: ok, detail: `视频生成中 ${doneN}/${clips.length}` });
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = {};
  try { json = JSON.parse(text); } catch { /* keep */ }
  if (!res.ok) {
    throw new Error(`Ark API ${res.status}: ${(json.error && (json.error.message || json.error.code)) || text.slice(0, 300)}`);
  }
  return json;
}

async function getJson(url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${KEY}` } });
  const text = await res.text();
  let json = {};
  try { json = JSON.parse(text); } catch { /* keep */ }
  if (!res.ok) throw new Error(`Ark 查询 ${res.status}: ${text.slice(0, 300)}`);
  return json;
}

function firstVideoUrl(obj) {
  if (!obj || typeof obj !== 'object') return '';
  if (typeof obj.video_url === 'string' && obj.video_url) return obj.video_url;
  for (const k of ['url', 'download_url', 'videoUrl']) {
    if (typeof obj[k] === 'string' && obj[k]) return obj[k];
  }
  if (Array.isArray(obj.content)) {
    for (const c of obj.content) {
      const v = firstVideoUrl(c);
      if (v) return v;
    }
  }
  for (const k of Object.keys(obj)) {
    if (k === 'video_url' || k === 'url' || k === 'content') continue;
    const v = firstVideoUrl(obj[k]);
    if (v) return v;
  }
  return '';
}

function normStatus(s) {
  const x = String(s || '').toLowerCase();
  if (/(^|_)(success|succeeded|done|completed|complete)$/.test(x) || x === 'success' || x === 'succeeded' || x === 'done') return 'done';
  if (/(fail|error|cancel|expired|invalid)/.test(x)) return 'failed';
  return 'pending';
}

// ── 主流程 ─────────────────────────────────────────────────────────
async function main() {
  if (!KEY) return fail('未配置 ARK_API_KEY（web-system/.env）');
  if (!ASSET_BASE) return fail('未配置 PUBLIC_ASSET_BASE：图片需公网可达（web-system/.env，例如 https://assets.your-site.com）');

  const genFile = path.join(DATA_DIR, `${rawId}.json`);
  if (!fs.existsSync(genFile)) return fail(`找不到生成包 data/generated/${rawId}.json`);
  const gen = JSON.parse(fs.readFileSync(genFile, 'utf-8'));
  if (!gen || !Array.isArray(gen.sections)) return fail('生成包结构不完整');

  const heroPrompt = String(gen.definingLine || gen.sections[0]?.original || gen.title || '').slice(0, 120);

  // 图片引用防御：历史生成包存在图文错位（scene-1 误指 hero.jpg 等）。
  // 规则：优先采用与 scene id 匹配的声明路径；不匹配时按 id 推导规范路径
  // /generated/<poemId>/<sceneId>.jpg；同一张图仅保留首个 clip（hero 去重）。
  const toRel = (sceneId) => `/generated/${rawId}/${sceneId}.jpg`;
  const resolveImage = (sceneId, declared) => {
    const ok = typeof declared === 'string' && declared.startsWith('/generated/');
    return ok && declared.endsWith(`/${sceneId}.jpg`) ? declared : toRel(sceneId);
  };
  const clips = [];
  const seenImg = new Set();
  const heroRaw = typeof gen.heroImage === 'string' && gen.heroImage.startsWith('/generated/') ? gen.heroImage : '';
  if (heroRaw) {
    seenImg.add(heroRaw);
    clips.push({ id: 'hero', image: heroRaw, prompt: heroPrompt });
  }
  for (const s of gen.sections) {
    const sid = String(s.id || `scene-${clips.length}`);
    const image = resolveImage(sid, s.image);
    if (image && !seenImg.has(image)) {
      seenImg.add(image);
      clips.push({ id: sid, image, prompt: String(s.original || '').slice(0, 120) });
    }
  }
  if (!clips.length) return fail('生成包内没有可用图片（需 /generated/ 开头的图片路径）');

  const plan = clips.map((c) => ({ ...c, url: `${ASSET_BASE}${c.image}`, status: 'queued', arkId: '', videoUrl: '', localUrl: '', error: '' }));
  savePatch({ poemId: rawId, stage: 'submit', detail: `提交 ${plan.length} 个视频任务…`, clips: plan });

  // 1) 逐条提交（图 + 诗句 → 一个任务）
  for (const c of plan) {
    try {
      const body = {
        model: MODEL,
        content: [
          { type: 'text', text: c.prompt },
          { type: 'image_url', image_url: { url: c.url }, role: 'reference_image' },
        ],
        ratio: RATIO,
        duration: DURATION,
        generate_audio: GENERATE_AUDIO,
        watermark: WATERMARK,
      };
      const r = await postJson(ARK_URL, body);
      c.arkId = String(r.id || '');
      c.status = 'submitted';
      console.log(`[submit] ${c.id} -> ${c.arkId} (${c.prompt.slice(0, 20)}…)`);
    } catch (e) {
      c.status = 'failed';
      c.error = e instanceof Error ? e.message : String(e);
      console.error(`[submit-fail] ${c.id}: ${c.error}`);
    }
    savePatch({ clips: plan });
    progress();
  }

  // 2) 轮询直到全部终态
  const MAX_ROUNDS = 450; // 450×8s ≈ 1 小时兜底
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const pend = plan.filter((c) => c.status !== 'done' && c.status !== 'failed');
    if (!pend.length) break;
    savePatch({ stage: 'render', detail: `生成中 ${plan.filter((c) => c.status === 'done').length}/${plan.length}` });
    for (const c of pend) {
      if (!c.arkId) continue;
      try {
        const r = await getJson(`${ARK_URL}/${c.arkId}`);
        const st = normStatus(r.status || r.state);
        if (st === 'done') {
          c.videoUrl = firstVideoUrl(r.content) || firstVideoUrl(r);
          c.status = 'done';
          console.log(`[done] ${c.id}`);
        } else if (st === 'failed') {
          c.status = 'failed';
          c.error = JSON.stringify(r.error || r).slice(0, 300);
          console.error(`[fail] ${c.id}: ${c.error}`);
        }
      } catch (e) {
        console.warn(`[poll-warn] ${c.id}: ${e instanceof Error ? e.message : e}`);
      }
    }
    savePatch({ clips: plan });
    progress();
    if (!plan.some((c) => c.status !== 'done' && c.status !== 'failed')) break;
    await new Promise((r2) => setTimeout(r2, 8000));
  }

  // 3) 下载完成的 mp4 到 public/videos/<poemId>/
  const outDir = path.join(PUB_VIDEO, rawId);
  fs.mkdirSync(outDir, { recursive: true });
  for (const c of plan) {
    if (c.status !== 'done' || !c.videoUrl) continue;
    try {
      const res = await fetch(c.videoUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const name = `${c.id}.mp4`;
      fs.writeFileSync(path.join(outDir, name), buf);
      c.localUrl = `/videos/${rawId}/${name}`;
      console.log(`[download] ${c.localUrl} (${(buf.length / 1048576).toFixed(1)} MB)`);
    } catch (e) {
      console.warn(`[download-warn] ${c.id}: ${e instanceof Error ? e.message : e}（保留远端 videoUrl）`);
    }
  }

  const doneN = plan.filter((c) => c.status === 'done').length;
  savePatch({
    status: doneN === plan.length ? 'done' : plan.length ? 'partial' : 'error',
    stage: 'done',
    progress: doneN,
    clips: plan,
    detail: `完成 ${doneN}/${plan.length}`,
    completedAt: Date.now(),
  });
  console.log(`\n完成: ${doneN}/${plan.length} 段视频 → public/videos/${rawId}/`);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
