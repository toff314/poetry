#!/usr/bin/env node
/**
 * 将一首诗已生成的逐段 AI 视频拼接为一部整片（顺序 concat）。
 *
 * 用法（cwd = web-system，或任意位置）：
 *   node scripts/concat-video.mjs <poemId> [--include-hero]
 *
 * 规则：
 *   - 读取 data/videos/<poemId>.json 的 clips（数组顺序即叙事顺序）
 *   - 默认跳过 hero（定场段诗句与首段重复，且首屏已有静态 hero 展示），只拼 scene-N 场景段
 *   - 校验每段 status=done 且源文件存在
 *   - 输出 public/videos/<poemId>/full.mp4（各段同批生成，编码一致时 -c copy 无损拼接）
 */
import { readFileSync, writeFileSync, existsSync, renameSync, unlinkSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..'); // web-system

const poemId = process.argv[2];
const includeHero = process.argv.includes('--include-hero');
if (!poemId) {
  console.error('用法: node scripts/concat-video.mjs <poemId> [--include-hero]');
  process.exit(2);
}

const recordPath = path.join(ROOT, 'data', 'videos', `${poemId}.json`);
if (!existsSync(recordPath)) {
  console.error(`未找到视频任务记录: ${recordPath}`);
  process.exit(1);
}
const record = JSON.parse(readFileSync(recordPath, 'utf8'));

let clips = (record.clips || []).slice();
if (!includeHero) clips = clips.filter((c) => c.id !== 'hero');
if (clips.length === 0) {
  console.error('没有可拼接的场景段（clips 为空或只剩 hero 且未 --include-hero）');
  process.exit(1);
}

// 校验
const bad = clips.filter((c) => c.status !== 'done' || !c.localUrl);
if (bad.length > 0) {
  console.error(`存在未完成/无地址的片段，无法拼接: ${bad.map((c) => c.id).join(', ')}`);
  process.exit(1);
}
const srcs = clips.map((c) => {
  const rel = String(c.localUrl).replace(/^\//, '');
  const abs = path.join(ROOT, 'public', rel);
  if (!existsSync(abs)) {
    console.error(`片段源文件缺失: ${abs}`);
    process.exit(1);
  }
  return abs;
});

// 拼接列表
const listPath = path.join(os.tmpdir(), `poetry-concat-${poemId}-${Date.now()}.txt`);
writeFileSync(
  listPath,
  srcs.map((p) => `file '${String(p).replace(/'/g, `'\\''`)}'`).join('\n') + '\n',
  'utf8',
);

const outDir = path.join(ROOT, 'public', 'videos', poemId);
mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'full.mp4');
const tmpPath = `${outPath}.tmp-${Date.now()}`;

try {
  const r = spawnSync(
    'ffmpeg',
    ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', '-f', 'mp4', tmpPath],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) {
    console.error('ffmpeg 拼接失败:\n' + (r.stderr || r.stdout || ''));
    process.exit(1);
  }
  if (existsSync(outPath)) unlinkSync(outPath);
  renameSync(tmpPath, outPath);

  const p = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', outPath], { encoding: 'utf8' });
  const dur = p.stdout ? parseFloat(p.stdout.trim()).toFixed(1) : '?';
  console.log(`✅ 整片已生成: /videos/${poemId}/full.mp4`);
  console.log(`   片段: ${clips.map((c) => c.id).join(' → ')}`);
  console.log(`   时长: ${dur}s`);
} finally {
  try { unlinkSync(listPath); } catch { /* ignore */ }
  try { unlinkSync(tmpPath); } catch { /* ignore */ }
}