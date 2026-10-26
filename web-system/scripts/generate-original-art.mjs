#!/usr/bin/env node
/**
 * generate-original-art.mjs — 原创诗馆 · AI 自动配图（doubao-cli 豆包网页版 Seedream）
 *
 * 用法: node scripts/generate-original-art.mjs <originalId> [--force]
 *
 * 读取 data/original/<id>.json，逐幕生图（hero + 每段），完成后回写图片 URL。
 * 进度写入 data/tasks/original-art-<id>.json（status: running/done/error）。
 * 已存在且非空的图片默认跳过（--force 重生成）。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ORIGINAL_DIR = path.join(ROOT, 'data', 'original');
const TASK_DIR = path.join(ROOT, 'data', 'tasks');
const PUB_GEN = path.join(ROOT, 'public', 'generated');

const id = process.argv[2];
const FORCE = process.argv.includes('--force');
if (!id) {
  console.error('用法: node scripts/generate-original-art.mjs <originalId> [--force]');
  process.exit(1);
}

const poemFile = path.join(ORIGINAL_DIR, `${id}.json`);
if (!fs.existsSync(poemFile)) {
  console.error(`原创诗不存在: ${poemFile}`);
  process.exit(1);
}
fs.mkdirSync(TASK_DIR, { recursive: true });

const taskFile = path.join(TASK_DIR, `original-art-${id}.json`);
function saveTask(patch) {
  let cur = {};
  try { cur = JSON.parse(fs.readFileSync(taskFile, 'utf-8')); } catch { /* fresh */ }
  fs.writeFileSync(taskFile, JSON.stringify({ ...cur, ...patch }, null, 2));
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

const poem = JSON.parse(fs.readFileSync(poemFile, 'utf-8'));
const sections = poem.sections || [];
const genDir = path.join(PUB_GEN, id);
fs.mkdirSync(genDir, { recursive: true });

saveTask({ status: 'running', stage: 'init', progress: 0, detail: '准备生图…', poemId: id, startedAt: Date.now() });
console.log(`[init] ${poem.title} · 共 ${sections.length + 1} 张`);

// ── 分镜提示：hero 用 intro，每幕用 analysis（兜底 original） ──────
const SUFFIX = '；写实历史电影质感、真实摄影、无文字、无书法、无印章、无水印、无现代物体';
function buildPrompt(hint) {
  return `电影感写实古风画面（古典氛围、真实摄影质感）：${hint}${SUFFIX}`;
}
const imgTasks = [
  { name: 'hero', hint: poem.intro || `${poem.title}。${poem.definingLine || ''}` },
  ...sections.map((s, i) => ({
    name: `scene-${i + 1}`,
    hint: s.analysis || s.original,
  })),
];

const DOUBAO_CLI = ['/usr/local/bin/doubao-cli', '/usr/bin/doubao-cli'].find((p) => {
  try { fs.accessSync(p, fs.constants.X_OK); return true; } catch { return false; }
}) || 'doubao-cli';

function runDoubaoImage(prompt, out) {
  let lastErr = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'poetry-doubao-'));
    const r = spawnSync(DOUBAO_CLI, ['generate', prompt, '--ratio', '16:9', '--compress-width', '0', '--output', tmp], {
      encoding: 'utf-8',
      timeout: 300000,
    });
    const src = path.join(tmp, 'cover.jpeg');
    if (r.status === 0 && fs.existsSync(src)) {
      fs.copyFileSync(src, out);
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
      return;
    }
    lastErr = (r.stderr || r.stdout || '').slice(-400);
    console.error(`doubao-cli 第 ${attempt} 次失败:`, lastErr || '(空)');
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
    if (attempt === 1) sleep(20000);
  }
  throw new Error(`生图失败 ${out}（doubao）`);
}

try {
  for (let i = 0; i < imgTasks.length; i++) {
    const t = imgTasks[i];
    const out = path.join(genDir, `${t.name}.jpg`);
    const progress = Math.round((i / imgTasks.length) * 90);
    if (!FORCE && fs.existsSync(out) && fs.statSync(out).size > 0) {
      console.log(`[skip] ${t.name} 已存在`);
      saveTask({ stage: 'images', progress, detail: `复用 ${t.name}` });
      continue;
    }
    saveTask({ stage: 'images', progress, detail: `AI 生图中 ${t.name} (${i + 1}/${imgTasks.length})…` });
    console.log(`[images] ${t.name} (${i + 1}/${imgTasks.length})`);
    runDoubaoImage(buildPrompt(t.hint), out);
    if (i < imgTasks.length - 1) {
      const pause = 15000 + Math.floor(Math.random() * 20000);
      console.log(`[生图节奏] 暂停 ${(pause / 1000).toFixed(0)}s`);
      sleep(pause);
    }
  }

  // 回写图片 URL（mtime 破 nginx 7d 缓存）
  const vOf = (file) => {
    try { return `?v=${Math.round(fs.statSync(file).mtimeMs)}`; } catch { return ''; }
  };
  poem.heroImage = `/generated/${id}/hero.jpg${vOf(path.join(genDir, 'hero.jpg'))}`;
  (poem.sections || []).forEach((s, i) => {
    s.image = `/generated/${id}/scene-${i + 1}.jpg${vOf(path.join(genDir, `scene-${i + 1}.jpg`))}`;
  });
  fs.writeFileSync(poemFile, JSON.stringify(poem, null, 2));
  saveTask({ status: 'done', stage: 'done', progress: 100, detail: '配图完成', completedAt: Date.now() });
  console.log('[done] 图片 URL 已回写', poemFile);
} catch (e) {
  saveTask({ status: 'error', error: String(e && e.message || e), completedAt: Date.now() });
  console.error('✗', e && e.message || e);
  process.exit(1);
}
