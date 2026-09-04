#!/usr/bin/env node
/**
 * tts-poem-narration.mjs — 为一首沉浸诗页生成"分场景朗诵音频"
 *
 * 结构：poem.audio = {
 *   defaultVoiceId: 'tencent-1004',
 *   voices: [ { id, engine, voice, label, scenes: { 'hero': url, 'scene-1': url, ... } } ]
 * }
 * 每个场景一段独立 MP3：朗读时按段顺序播放并滚动，天然获得"读哪段停哪段"的同步。
 *
 * 用法：
 *   node scripts/tts-poem-narration.mjs <poem-id>            # 生成默认音色集（tencent+edge 云扬）
 *   环境：TENCENT_VOICE=1004 可指定腾讯音色编号
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data', 'generated');
const AUDIO_ROOT = path.join(ROOT, 'public', 'audio');

const poemId = process.argv[2];
if (!poemId) {
  console.error('用法: node scripts/tts-poem-narration.mjs <poem-id>');
  process.exit(1);
}

const poem = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${poemId}.json`), 'utf-8'));
if (!poem.content) {
  console.error('缺少 content');
  process.exit(1);
}

// 朗读场景（标题作者行 + 每段原文）
const scenes = [{ id: 'hero', text: `${poem.title}。${poem.author}。` }];
for (const s of poem.sections) {
  scenes.push({ id: s.id, text: s.original });
}

// 微软 Edge 中文音色预设（可整体勾选加入朗读者列表）
const EDGE_PRESETS = [
  { id: 'edge-xiaoxiao', voice: 'zh-CN-XiaoxiaoNeural', label: '微软 Edge · 晓晓（女）' },
  { id: 'edge-xiaoyi', voice: 'zh-CN-XiaoyiNeural', label: '微软 Edge · 晓伊（女）' },
  { id: 'edge-yunxi', voice: 'zh-CN-YunxiNeural', label: '微软 Edge · 云希（男·青年）' },
  { id: 'edge-yunjian', voice: 'zh-CN-YunjianNeural', label: '微软 Edge · 云健（男·沉稳）' },
  { id: 'edge-yunyang', voice: 'zh-CN-YunyangNeural', label: '微软 Edge · 云扬（男·醇厚）' },
];

const voiceDir = (voiceId) => path.join(AUDIO_ROOT, poemId, voiceId);

function runTTS(engine, text, voice, out) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const r = spawnSync(
    'node',
    [path.join(__dirname, 'tts-voice.mjs'), text, '--engine', engine, '--voice', voice, '--output', out],
    { encoding: 'utf-8', timeout: 120000 }
  );
  if (r.status !== 0) throw new Error(`${engine} 失败: ${(r.stderr || r.stdout || '').slice(-300)}`);
  return out;
}

async function buildVoice(engine, voice, label, voiceId, defaultScenes) {
  const dir = voiceDir(voiceId);
  const scenesOut = {};
  console.log(`\n[${label}] ${engine}/${voice}`);
  for (const sc of scenes) {
    const out = path.join(dir, `${sc.id}.mp3`);
    if (fs.existsSync(out) && !process.env.FORCE) {
      console.log(`  跳过(已存在) ${sc.id}`);
    } else {
      const f = runTTS(engine, sc.text, voice, out);
      console.log(`  ✓ ${sc.id} → ${path.basename(f)}`);
    }
    scenesOut[sc.id] = `/audio/${poemId}/${voiceId}/${sc.id}.mp3`;
  }
  return { id: voiceId, engine, voice, label, scenes: scenesOut };
}

async function main() {
  const tencentVoice = process.env.TENCENT_VOICE || '502004';
  const voices = [];
  if (process.env.SKIP_TENCENT !== '1') {
    voices.push(await buildVoice('tencent', tencentVoice, '腾讯云 · 超自然大模型', `tencent-${tencentVoice}`, null));
  }
  for (const p of EDGE_PRESETS) {
    voices.push(await buildVoice('edge', p.voice, p.label, p.id, null));
  }

  poem.audio = {
    defaultVoiceId: voices[0].id,
    voices,
  };
  fs.writeFileSync(path.join(DATA_DIR, `${poemId}.json`), JSON.stringify(poem, null, 2));
  console.log('\n已更新 poem.audio:', poem.audio.defaultVoiceId, 'voices:', voices.length);
}

main().catch((e) => {
  console.error('✗', e.message);
  process.exit(1);
});
