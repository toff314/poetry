#!/usr/bin/env node
/**
 * generate-ai.mjs — AI 沉浸页完整流水线（异步任务脚本）
 *
 * 用法: node scripts/generate-ai.mjs <rawPoemId> [--voice edge-yunjian] [--task <taskId>]
 *
 * 流程: 取原诗 → 分镜(注解库/自动) → doubao 逐场景生图 → 压缩 → TTS 分段朗诵 → 组装 generated json
 * 进度: 写入 data/tasks/<taskId>.json，供 GET /api/generate-ai/:taskId 轮询
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data', 'generated');
const ANNO_DIR = path.join(ROOT, 'data', 'annotations');
const TASK_DIR = path.join(ROOT, 'data', 'tasks');
const PUB_GEN = path.join(ROOT, 'public', 'generated');
const PUB_AUDIO = path.join(ROOT, 'public', 'audio');
const POETRY_DB = path.join(ROOT, 'data', 'poetry.db');

const rawId = process.argv[2];
const argVoice = (process.argv.find((a) => a === '--voice') && process.argv[process.argv.indexOf('--voice') + 1]) || 'edge-yunjian';
const taskIdx = process.argv.indexOf('--task');
const taskId = (taskIdx !== -1 && process.argv[taskIdx + 1]) || rawId;

if (!rawId) {
  console.error('用法: node scripts/generate-ai.mjs <rawPoemId> [--voice edge-yunjian] [--task <taskId>]');
  process.exit(1);
}
fs.mkdirSync(TASK_DIR, { recursive: true });

const task = { status: 'running', stage: 'init', progress: 0, detail: '', generatedId: rawId, startedAt: Date.now() };
function saveTask() {
  fs.writeFileSync(path.join(TASK_DIR, `${taskId}.json`), JSON.stringify(task, null, 2));
}
saveTask();
function setStage(stage, progress, detail) {
  task.stage = stage;
  task.progress = progress;
  task.detail = detail || '';
  saveTask();
  console.log(`[${stage}] ${detail || ''}`);
}
function fail(msg) {
  task.status = 'error';
  task.error = msg;
  saveTask();
  console.error('✗', msg);
  process.exit(1);
}

// ── 文案通道：注解库 > opencode(LLM) > 自动模板 ──────────────────
function chunkClauses(content) {
  return (content || '')
    .replace(/\n/g, '')
    .match(/[^，。！？；、]+[，。！？；、]?/g)
    ?.map((t) => t.trim())
    .filter(Boolean) || [];
}

function extractJson(text) {
  if (!text) return null;
  const t = text.replace(/```json|```/g, '').trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a === -1 || b === -1 || b <= a) return null;
  try {
    return JSON.parse(t.slice(a, b + 1));
  } catch {
    return null;
  }
}

function llmBuildPlan(poem) {
  const clauses = chunkClauses(poem.content);
  if (!clauses.length) return null;
  const numbered = clauses.map((c, i) => `${i + 1}. ${c}`).join('\n');
  const prompt = `你是中国古典文学资深编辑，为一首${poem.dynasty || ''}诗词制作沉浸式阅读页的分镜方案。
全诗（已按句切分编号）：
${numbered}

要求：
1. 将全诗切分为 5-6 个连续、不重叠、覆盖全诗的段落（每段 2-6 句，按意象/情绪转折分段）。
2. 输出 JSON（只输出 JSON，不要 markdown 围栏、不要解释），结构：
{
 "kicker": "时代+体裁标签，如 盛唐 · 歌行 / 宋词 · 豪放，10字内",
 "definingLine": "全诗定场句（取开头最有力的一句原文）",
 "intro": "80-120字，介绍作者、此诗情境与核心情绪",
 "closing": "含四层的读诗札记：\n【体式】…\n【意象系统】…\n【情感运动】…\n【核心张力】…（每层 50-90 字，具体分析本诗）",
 "heroHint": "40-70字，主视觉画面的写实电影感描述（时代风貌+核心意象+氛围色调）",
 "segments": [
   { "clauseStart": 1, "clauseEnd": 2,
     "literal": "现代汉语直译本段，40-90字",
     "analysis": "细读本段：关键词/手法/情绪功能，40-80字，具体不空泛",
     "imageHint": "30-60字，本段可拍摄的电影感画面（主体、动作、光线）" }
 ]
}
3. clauseStart/clauseEnd 为上述编号（1 起）。original 不需输出，按编号范围截取原句即可。
4. 语气克制，勿用"伟大/绝美/最强"等拔高词；直译口语化；分析落到字词与句法。
5. 【硬性】所有字符串值内禁止出现英文双引号（\"）；如需引用书名/短语一律用中文引号「」或“”。输出必须是可以直接 JSON.parse 的合法 JSON。`;
  const r = spawnSync(
    process.env.OPENCODE_BIN || '/root/.opencode/bin/opencode',
    ['run', prompt],
    { encoding: 'utf-8', timeout: 600000, env: { ...process.env, PATH: `${process.env.PATH || ''}:/root/.opencode/bin` } }
  );
  if (r.status !== 0) {
    console.error('opencode 失败:', (r.stderr || r.stdout || '').slice(-400));
    return null;
  }
  const data = extractJson(r.stdout);
  if (!data || !Array.isArray(data.segments) || !data.segments.length) {
    console.error('opencode 输出无法解析:', r.stdout.slice(0, 600));
    return null;
  }
  const sections = data.segments.map((seg) => {
    const a = Math.max(0, (Number(seg.clauseStart) || 1) - 1);
    const b = Math.min(clauses.length, Number(seg.clauseEnd) || a + 1);
    return {
      original: clauses.slice(a, b).join(''),
      literal: seg.literal || '',
      analysis: seg.analysis || '',
      imageHint: seg.imageHint || seg.literal || '',
    };
  });
  return {
    title: poem.title, author: poem.author, dynasty: poem.dynasty || '',
    kicker: data.kicker || 'AI 沉浸式生成',
    definingLine: data.definingLine || (clauses[0] || '').slice(0, 40),
    intro: data.intro || '',
    heroHint: data.heroHint || '',
    sections,
    closing: data.closing || '',
    auto: true,
  };
}

function autoPlan(poem) {
  const clauses = chunkClauses(poem.content);
  const groupCount = 5;
  const size = Math.max(1, Math.ceil(clauses.length / groupCount));
  const groups = [];
  for (let i = 0; i < clauses.length; i += size) groups.push(clauses.slice(i, i + size).join(''));
  return {
    title: poem.title, author: poem.author, dynasty: poem.dynasty || '',
    kicker: 'AI 自动生成',
    definingLine: (clauses[0] || poem.title).slice(0, 40),
    intro: `${poem.title}由诗境自动流水线生成……`,
    heroHint: `${poem.title}·${poem.author}，将全诗意境凝于一图，写实电影感古典场景`,
    sections: groups.map((g) => ({ original: g, literal: '', analysis: '', imageHint: g.slice(0, 40) })),
    closing: '此页由自动化流水线生成：画面为 AI 依原文创作，朗诵为神经网络语音。',
    auto: true,
  };
}

const db = new DatabaseSync(POETRY_DB, { readOnly: true });
let poem = null;
// 重制模式：诗词库没有该 id（如历史 UUID 作品）时，回退读取既有成品包里的原文
if (globalThis.__remadePoem) {
  poem = globalThis.__remadePoem;
} else {
  poem = db.prepare('SELECT id,title,author,dynasty,content FROM poems WHERE id=?').get(rawId);
}
db.close();
if (!poem) {
  const oldFile = path.join(DATA_DIR, `${rawId}.json`);
  if (fs.existsSync(oldFile)) {
    try {
      const old = JSON.parse(fs.readFileSync(oldFile, 'utf-8'));
      if (old && old.content) {
        poem = { id: String(rawId), title: old.title || '', author: old.author || '', dynasty: old.dynasty || '', content: old.content };
        console.log('[remake] 诗词库无此 id，载入既有成品原文重制:', rawId);
      }
    } catch (e) {
      console.error('读取既有成品失败:', String(e));
    }
  }
}
if (!poem) fail('找不到原诗 id=' + rawId);

// ── 1. 分镜（注解库优先，否则自动切分） ─────────────────────────────
const CN_NUM = ['一', '二', '三', '四', '五', '六', '七'];
const annotationPath = path.join(ANNO_DIR, `${rawId}.json`);
const hasAnno = fs.existsSync(annotationPath);
let plan;
if (hasAnno) {
  plan = JSON.parse(fs.readFileSync(annotationPath, 'utf-8'));
  plan.auto = false;
} else {
  plan = llmBuildPlan(poem);
  if (!plan) {
    plan = autoPlan(poem);
    task.detail = '文案由自动模板生成（opencode 不可用）';
    saveTask();
  }
}
const sections = plan.sections;
if (sections.length > 6) {
  // 注解分段超 6 时截断至 6（页面演示节奏），extra 并入前段
  const merged = [...sections];
  while (merged.length > 6) {
    const last = merged.pop();
    const prev = merged[merged.length - 1];
    prev.original = `${prev.original} ${last.original}`;
    prev.literal = `${prev.literal} ${last.literal}`.trim();
    prev.analysis = prev.analysis || last.analysis;
  }
  plan.sections = merged;
}

// dry-run：只生成分镜文案，便于验证（不烧 doubao 生图）
if (process.argv.includes('--dry-run')) {
  task.status = 'done';
  task.progress = 100;
  task.detail = '文案已生成（dry-run）';
  task.planSummary = {
    kicker: plan.kicker,
    sections: plan.sections.map((x) => ({ original: x.original, literalLen: (x.literal || '').length, analysisLen: (x.analysis || '').length })),
    closingLen: (plan.closing || '').length,
  };
  saveTask();
  console.log('\n[dry-run] 文案 OK → ' + JSON.stringify(task.planSummary, null, 2).slice(0, 1200));
  process.exit(0);
}

const genDir = path.join(PUB_GEN, rawId);
// 生图统一走火山方舟 Ark Seedream（ark-image.mjs，直出 1920 JPEG，替代 doubao-cli）

// ── 2. 生图（hero + 每段） ──────────────────────────────────────────
const ERA = String(poem.dynasty || '古典').replace('朝', '') || '古典';
function buildPrompt(hint) {
  return (
    `电影感写实古风画面（${ERA}氛围、真实摄影质感、克制水墨调色）：${hint}` +
    `；构图中主体偏右侧，左侧与下方保留暗部负空间以便叠加竖排诗句` +
    `；写实历史电影质感、真实摄影、无文字、无书法、无印章、无水印、无现代物体`
  );
}
const imgTasks = [
  { name: 'hero', hint: plan.heroHint },
  ...sections.map((s, i) => ({ name: `scene-${i + 1}`, hint: s.imageHint })),
];

setStage('images', 12, `开始 AI 生图（共 ${imgTasks.length} 张，每张约 30-60 秒）`);
for (let i = 0; i < imgTasks.length; i++) {
  const t = imgTasks[i];
  const out = path.join(genDir, `${t.name}.jpg`);
  setStage('images', 12 + Math.round((i / imgTasks.length) * 58), `AI 生图中 ${t.name} (${i + 1}/${imgTasks.length})…`);
  // 火山方舟 Seedream（ark-image.mjs 直出 1920 JPEG，替代 doubao-cli）
  const r = spawnSync('node', [path.join(__dirname, 'ark-image.mjs'), buildPrompt(t.hint), '--out', out, '--watermark', '0'], {
    encoding: 'utf-8',
    timeout: 420000,
  });
  if (r.status !== 0) {
    console.error('ark-image stderr:', (r.stderr || '').slice(-400));
    fail(`生图失败 ${t.name}`);
  }
}

// ── 4. 分段朗诵（默认云健） ────────────────────────────────────────
const voice = {
  'edge-yunjian': { engine: 'edge', voice: 'zh-CN-YunjianNeural', label: '微软 Edge · 云健（男·沉稳）' },
}[argVoice] || { engine: 'edge', voice: 'zh-CN-YunjianNeural', label: '微软 Edge · 云健（男·沉稳）' };
const voiceDir = path.join(PUB_AUDIO, rawId, argVoice);
fs.mkdirSync(voiceDir, { recursive: true });
const voiceScenes = { hero: `${plan.title}。${plan.author}。` };
sections.forEach((s, i) => { voiceScenes[`scene-${i + 1}`] = s.original; });

const scenes = [{ id: 'hero', text: voiceScenes.hero }, ...sections.map((s, i) => ({ id: `scene-${i + 1}`, text: s.original }))];
setStage('tts', 76, `生成朗诵语音（${voice.label}，${scenes.length} 段）…`);
const sceneUrls = {};
for (let i = 0; i < scenes.length; i++) {
  const sc = scenes[i];
  const out = path.join(voiceDir, `${sc.id}.mp3`);
  setStage('tts', 76 + Math.round((i / scenes.length) * 14), `朗诵生成中 ${sc.id} (${i + 1}/${scenes.length})…`);
  const tr = spawnSync(
    'node',
    [path.join(__dirname, 'tts-voice.mjs'), sc.text, '--engine', voice.engine, '--voice', voice.voice, '--output', out],
    { encoding: 'utf-8', timeout: 180000 }
  );
  if (tr.status !== 0) {
    console.error((tr.stderr || tr.stdout || '').slice(-300));
    fail(`朗诵生成失败 ${sc.id}`);
  }
  sceneUrls[sc.id] = `/audio/${rawId}/${argVoice}/${sc.id}.mp3`;
}

// ── 5. 组装 generated json ─────────────────────────────────────────
setStage('assemble', 96, '组装页面数据…');
const generated = {
  id: String(rawId),
  title: String(plan.title || poem.title || ''),
  author: String(plan.author || poem.author || ''),
  dynasty: String(plan.dynasty || poem.dynasty || ''),
  content: poem.content,
  kicker: plan.kicker || 'AI 沉浸式生成',
  definingLine: plan.definingLine || '',
  intro: plan.intro || '',
  heroImage: `/generated/${rawId}/hero.jpg`,
  sections: sections.map((s, i) => ({
    id: `scene-${i + 1}`,
    index: CN_NUM[i] || String(i + 1),
    original: s.original,
    literal: s.literal,
    analysis: s.analysis,
    image: `/generated/${rawId}/scene-${i + 1}.jpg`,
  })),
  closing: plan.closing || '',
  audio: {
    defaultVoiceId: argVoice,
    voices: [{ id: argVoice, engine: voice.engine, voice: voice.voice, label: voice.label, scenes: sceneUrls }],
  },
};
fs.writeFileSync(path.join(DATA_DIR, `${rawId}.json`), JSON.stringify(generated, null, 2));

// 更新 index.json
const idxPath = path.join(DATA_DIR, 'index.json');
const index = fs.existsSync(idxPath) ? JSON.parse(fs.readFileSync(idxPath, 'utf-8')) : { poems: [] };
if (!index.poems.find((p) => p.id === String(rawId))) {
  index.poems.push({ id: String(rawId), title: generated.title, author: generated.author });
  fs.writeFileSync(idxPath, JSON.stringify(index, null, 2));
}

task.status = 'done';
task.progress = 100;
task.detail = '生成完成';
task.generatedId = String(rawId);
task.sections = generated.sections.length;
task.voice = argVoice;
saveTask();
console.log(`\n✓ 完成：/generated/${rawId}.json（${generated.sections.length} 段 · 默认 ${argVoice}）`);