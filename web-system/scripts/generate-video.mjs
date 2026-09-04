#!/usr/bin/env node
/**
 * generate-video.mjs — 为某首诗的沉浸页逐画面生成短视频（火山方舟 Ark · Seedance）
 *
 * 用法:
 *   node scripts/generate-video.mjs <poemId> [--task <taskId>] [--avatar <asset-xxxx>]
 *
 * 两种模式：
 *   A) 图生视频（默认）：每张图（hero / scene-N）配对应诗句 → 一个视频任务
 *   B) 虚拟人像模式（--avatar asset-xxxx）：人物由官方虚拟人像库资产出演，
 *      每段诗句由虚拟形象演绎 → 不涉及真人肖像合规拦截。
 *      API：reference_images:["asset://<id>"] + use_virtual_avatar:true
 *
 * 成品：轮询 → 下载 mp4 到 public/videos/<poemId>/；已有成品片段自动复用（不重复提交）。
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
const taskIdx = process.argv.indexOf('--task');
const taskId = (taskIdx !== -1 && process.argv[taskIdx + 1]) || rawId;
const avIdx = process.argv.indexOf('--avatar');
const avatar = (avIdx !== -1 && process.argv[avIdx + 1]) || '';
if (!rawId) {
  console.error('用法: node scripts/generate-video.mjs <poemId> [--task <taskId>] [--avatar <asset-xxxx>]');
  process.exit(1);
}

const ARK_BASE = process.env.ARK_API_BASE || 'https://ark.cn-beijing.volces.com/api';
const ARK_URL = `${ARK_BASE}/v3/contents/generations/tasks`;
const MODEL = process.env.ARK_MODEL || 'doubao-seedance-2-0-mini-260615';
const RATIO = process.env.VIDEO_RATIO || '16:9';
const DURATION = Number(process.env.VIDEO_DURATION || 11);
const GENERATE_AUDIO = String(process.env.VIDEO_AUDIO ?? 'true') === 'true';
const WATERMARK = String(process.env.VIDEO_WATERMARK ?? 'false') === 'true';
const KEY = process.env.ARK_API_KEY || '';
const ASSET_BASE = String(process.env.PUBLIC_ASSET_BASE || '').replace(/\/$/, '');
// 虚拟人像：--avatar <id> 显式指定；--avatar auto 在 main 内按「作者→诗人主形象」解析（需 gen.author）
let avatarUse = avatar;
let avatarMode = avatar !== '' && avatar !== 'auto' && !!avatar;

// 提示词模板：诗句字幕由前端叠加，画面内不出现文字；构图保留竖排负空间
function buildTextPrompt(c, isAvatar) {
  const line = c.prompt || '';
  const frame =
    `画面内不出现任何文字、字幕、书法或水印标记；构图为人物与主体居中偏左或右侧留景，` +
    `画面右侧或下部保留暗色负空间，便于前端叠加竖排诗句字幕；写实电影感古风，克制水墨调色，真实历史质感。`;
  if (isAvatar) {
    // 虚拟人像：先口播台词（诗句），再给画面指令，避免把画面指令当台词念出
    return `【台词】请用中文清晰、缓慢、字正腔圆地朗诵以下诗句，口型与吐字同步："${line}"。${frame}`;
  }
  return `${line}。${frame}`;
}


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
function progress(plan) {
  const doneN = plan.filter((c) => c.status === 'done').length;
  savePatch({ progress: plan.length ? Math.round((doneN / plan.length) * 100) : 0, detail: `视频生成中 ${doneN}/${plan.length}` });
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
  if (/(^|_)(success|succeeded|done|completed|complete)$/.test(x) || x === 'done') return 'done';
  if (/(fail|error|cancel|expired|invalid)/.test(x)) return 'failed';
  return 'pending';
}

// ── 主流程 ─────────────────────────────────────────────────────────
async function main() {
  if (!KEY) return fail('未配置 ARK_API_KEY（web-system/.env）');
  const genFile = path.join(DATA_DIR, `${rawId}.json`);
  if (!fs.existsSync(genFile)) return fail(`找不到生成包 data/generated/${rawId}.json`);
  const gen = JSON.parse(fs.readFileSync(genFile, 'utf-8'));
  if (!gen || !Array.isArray(gen.sections)) return fail('生成包结构不完整');

  // auto：按作者查 poets 映射取主形象（整诗固定一张脸）；未收录诗人回退古风池按 poemId hash
  if (avatar === 'auto') {
    const avFile = path.join(ROOT, 'avatars.json');
    let picked = '';
    try {
      const lib = JSON.parse(fs.readFileSync(avFile, 'utf-8'));
      const author = String(gen.author || '');
      const pm = (lib.poets || {})[author];
      if (pm && pm.main) {
        picked = pm.main;
        console.log(`[avatar-auto] ${author} 主形象: ${picked}`);
      } else {
        const cand = (lib.items || []).filter((i) => i.ancient === true && i.id && !i.placeholder);
        const h = (str) => { let x = 0; for (const ch of String(str)) x = (x * 31 + ch.codePointAt(0)) >>> 0; return x; };
        picked = cand.length ? cand[h(rawId) % cand.length].id : 'asset-20260804202330-bps7t';
        console.log(`[avatar-auto] 未收录诗人「${author || '?'}」，回退池选 ${picked}`);
      }
    } catch (e) { console.warn('[avatar-auto] 读取形象库失败:', String(e)); }
    avatarUse = picked;
    avatarMode = !!avatarUse;
  }
  if (!avatarMode && !ASSET_BASE) return fail('图生视频需配置 PUBLIC_ASSET_BASE；虚拟人像模式请用 --avatar auto 或 --avatar <asset-id>');

  const heroPrompt = String(gen.definingLine || gen.sections[0]?.original || gen.title || '').slice(0, 120);
  const clips = [];
  if (avatarMode) {
    // B) 虚拟人像模式：仅诗句驱动，人物由官方形象出演（无图参考）
    clips.push({ id: 'hero', image: '', prompt: heroPrompt });
    for (const s of gen.sections) {
      clips.push({ id: String(s.id || `scene-${clips.length}`), image: '', prompt: String(s.original || '').slice(0, 120) });
    }
  } else {
    // A) 图生视频：按 scene id 推导规范图路径（防御旧数据图文错位），同图去重
    const toRel = (sceneId) => `/generated/${rawId}/${sceneId}.jpg`;
    const resolveImage = (sceneId, declared) => {
      const ok = typeof declared === 'string' && declared.startsWith('/generated/');
      return ok && declared.endsWith(`/${sceneId}.jpg`) ? declared : toRel(sceneId);
    };
    const seenImg = new Set();
    const heroRaw = typeof gen.heroImage === 'string' && gen.heroImage.startsWith('/generated/') ? gen.heroImage : '';
    if (heroRaw) { seenImg.add(heroRaw); clips.push({ id: 'hero', image: heroRaw, prompt: heroPrompt }); }
    for (const s of gen.sections) {
      const sid = String(s.id || `scene-${clips.length}`);
      const image = resolveImage(sid, s.image);
      if (image && !seenImg.has(image)) { seenImg.add(image); clips.push({ id: sid, image, prompt: String(s.original || '').slice(0, 120) }); }
    }
  }
  if (!clips.length) return fail('没有可生成的片段');

  const plan = clips.map((c) => ({
    ...c,
    url: c.image ? `${ASSET_BASE}${c.image}` : '',
    status: 'queued', arkId: '', videoUrl: '', localUrl: '', error: '', createdAt: 0,
  }));
  // 复用历史成品（done 且可下载）→ 不重复提交
  const oldTask = loadTask();
  if (oldTask && Array.isArray(oldTask.clips)) {
    const doneMap = new Map(oldTask.clips.filter((c) => c.status === 'done' && (c.localUrl || c.videoUrl)).map((c) => [c.id, c]));
    let reused = 0;
    for (const c of plan) {
      const d = doneMap.get(c.id);
      if (d) { Object.assign(c, d, { status: 'done' }); reused += 1; }
    }
    if (reused) console.log(`[reuse] ${reused}/${plan.length} 段已有成品，跳过重生成`);
  }
  const todo = plan.filter((c) => c.status !== 'done');
  if (!todo.length) {
    savePatch({ poemId: rawId, status: 'done', stage: 'done', progress: plan.length, detail: '全部片段已有成品', clips: plan, avatar: avatarUse || '', completedAt: Date.now() });
    return console.log('全部片段已有成品（强制重跑请删除 data/videos/<poemId>.json）');
  }

  savePatch({
    poemId: rawId, status: 'running', avatar: avatarUse || '', stage: 'submit',
    detail: `${avatarMode ? `虚拟人像(${avatar})` : '图生视频'} · 提交 ${todo.length}/${plan.length} 个任务…`, clips: plan,
  });

  // 1) 提交
  const submitClip = async (c) => {
    const content = [{ type: 'text', text: buildTextPrompt(c, avatarMode) }];
    const body = avatarMode
      ? { model: MODEL, content, reference_images: [`asset://${avatarUse}`], use_virtual_avatar: true, ratio: RATIO, duration: DURATION, generate_audio: GENERATE_AUDIO, watermark: WATERMARK }
      : { model: MODEL, content: [...content, { type: 'image_url', image_url: { url: c.url }, role: 'reference_image' }], ratio: RATIO, duration: DURATION, generate_audio: GENERATE_AUDIO, watermark: WATERMARK };
    const r = await postJson(ARK_URL, body);
    c.arkId = String(r.id || '');
    c.status = 'submitted';
    c.createdAt = Date.now();
    return r;
  };
  for (const c of todo) {
    try {
      await submitClip(c);
      console.log(`[submit] ${c.id} -> ${c.arkId}`);
    } catch (e) {
      c.status = 'failed';
      c.error = e instanceof Error ? e.message : String(e);
      console.error(`[submit-fail] ${c.id}: ${c.error}`);
    }
    savePatch({ clips: plan });
    progress(plan);
  }

  // 2) 轮询
  const MAX_ROUNDS = 450;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const pend = plan.filter((c) => c.status !== 'done' && c.status !== 'failed');
    if (!pend.length) break;
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
    progress(plan);
    if (!plan.some((c) => c.status !== 'done' && c.status !== 'failed')) break;
    await new Promise((r2) => setTimeout(r2, 8000));
  }

  // 3) 下载
  const outDir = path.join(PUB_VIDEO, rawId);
  fs.mkdirSync(outDir, { recursive: true });
  for (const c of plan) {
    if (c.status !== 'done' || c.localUrl || !c.videoUrl) continue;
    try {
      const res = await fetch(c.videoUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const name = `${c.id}.mp4`;
      fs.writeFileSync(path.join(outDir, name), buf);
      c.localUrl = `/videos/${rawId}/${name}`;
      console.log(`[download] ${c.localUrl} (${(buf.length / 1048576).toFixed(1)} MB)`);
    } catch (e) {
      console.warn(`[download-warn] ${c.id}: ${e instanceof Error ? e.message : e}`);
    }
  }

  const doneN = plan.filter((c) => c.status === 'done').length;
  savePatch({
    status: doneN === plan.length ? 'done' : plan.length ? 'partial' : 'error',
    stage: 'done', progress: doneN, clips: plan,
    detail: `完成 ${doneN}/${plan.length}`, completedAt: Date.now(),
  });
  console.log(`\n完成: ${doneN}/${plan.length} 段视频 → public/videos/${rawId}/`);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
