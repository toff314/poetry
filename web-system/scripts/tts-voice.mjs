#!/usr/bin/env node
/**
 * tts-voice.mjs — 诗词朗诵语音生成器
 *
 * 引擎：
 *   tencent（默认）— 腾讯云语音合成 TTS（TC3-HMAC-SHA256 签名，读取 web-system/.env）
 *   edge          — 微软 Edge Neural（保留；云扬等音色做备选）
 *
 * 用法：
 *   node scripts/tts-voice.mjs "朗读文本" --engine tencent --voice 1004 --output a.mp3
 *   node scripts/tts-voice.mjs "朗读文本" --engine edge --edge-voice zh-CN-YunyangNeural --rate -10% --output a.mp3
 *   echo "文本" | node scripts/tts-voice.mjs --engine tencent --voice 1004 --output a.mp3
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function loadEnv() {
  const envFile = path.join(ROOT, '.env');
  const out = {};
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf-8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m) out[m[1]] = m[2].trim();
    }
  }
  return out;
}
const env = loadEnv();

function parseArgs(argv) {
  const args = {
    engine: 'tencent', voice: '1004', edgeVoice: 'zh-CN-YunyangNeural', rate: '-15%',
    speed: 0, modelType: 1, codec: 'mp3', output: '',
  };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--engine') args.engine = argv[++i];
    else if (a === '--voice') args.voice = argv[++i];
    else if (a === '--edge-voice') args.edgeVoice = argv[++i];
    else if (a === '--rate') args.rate = argv[++i];
    else if (a === '--speed') args.speed = Number(argv[++i]);
    else if (a === '--model-type') args.modelType = Number(argv[++i]);
    else if (a === '--codec') args.codec = argv[++i];
    else if (a === '--output' || a === '-o') args.output = argv[++i];
    else positional.push(a);
  }
  args.text = positional.join(' ').trim();
  return args;
}

// ── 腾讯云 TC3 签名请求 ──────────────────────────────────────────────
function tc3Sign(secretId, secretKey, service, host, action, version, region, payloadStr, timestamp) {
  const algorithm = 'TC3-HMAC-SHA256';
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const canonicalHeaders =
    `content-type:application/json; charset=utf-8\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`;
  const signedHeaders = 'content-type;host;x-tc-action';
  const canonicalRequest =
    `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n` +
    crypto.createHash('sha256').update(payloadStr).digest('hex');
  const credentialScope = `${date}/${service}/tc3_request`;
  const hashedCanonical = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
  const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${hashedCanonical}`;

  const kDate = crypto.createHmac('sha256', 'TC3' + secretKey).update(date).digest();
  const kService = crypto.createHmac('sha256', kDate).update(service).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('tc3_request').digest();
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  const authorization =
    `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return {
    'Authorization': authorization,
    'Content-Type': 'application/json; charset=utf-8',
    'Host': host,
    'X-TC-Action': action,
    'X-TC-Timestamp': String(timestamp),
    'X-TC-Version': version,
    'X-TC-Region': region,
  };
}

async function tencentTTS(text, voice, output, opts = {}) {
  const secretId = process.env.TENCENT_SECRET_ID || env.TENCENT_SECRET_ID;
  const secretKey = process.env.TENCENT_SECRET_KEY || env.TENCENT_SECRET_KEY;
  const region = process.env.TENCENT_TTS_REGION || env.TENCENT_TTS_REGION || 'ap-guangzhou';
  if (!secretId || !secretKey) {
    throw new Error('缺少腾讯云凭证：请在 web-system/.env 配置 TENCENT_SECRET_ID / TENCENT_SECRET_KEY');
  }
  const service = 'tts';
  const host = 'tts.tencentcloudapi.com';
  const action = 'TextToVoice';
  const version = '2019-08-23';
  const payload = {
    Text: text,
    SessionId: crypto.randomUUID(),
    ModelType: opts.modelType ?? 1,
    VoiceType: Number(voice) || 1004,
    Volume: 0,
    Speed: opts.speed ?? 0, // 腾讯合法范围 -2..6；超自然音色放慢易失真，默认正常语速
    ProjectId: 0,
    Codec: opts.codec || 'mp3',
  };
  if (opts.sampleRate) payload.SampleRate = opts.sampleRate;
  const payloadStr = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const headers = tc3Sign(secretId, secretKey, service, host, action, version, region, payloadStr, timestamp);

  const resp = await fetch(`https://${host}`, {
    method: 'POST',
    headers,
    body: payloadStr,
  });
  const data = await resp.json();
  const r = data?.Response;
  if (!r || !r.Audio) {
    const err = r?.Error || data?.Error || {};
    throw new Error(`腾讯 TTS 失败: ${err.Code || resp.status} ${err.Message || JSON.stringify(data).slice(0, 300)}`);
  }
  fs.writeFileSync(output, Buffer.from(r.Audio, 'base64'));
  return { engine: 'tencent', voice: String(voice), file: output, bytes: r.Audio.length };
}

// ── Edge-TTS（备选引擎） ─────────────────────────────────────────────
async function edgeTTS(text, voice, rate, output) {
  const skillDir = '/tmp/qagent_skills_da2e5e07276bbc6a_a0dd8ab3_607046/speech-synthesis/scripts';
  const conv = path.join(skillDir, 'tts-converter.js');
  if (!fs.existsSync(conv)) throw new Error('Edge-TTS 技能脚本不存在: ' + conv);
  const r = spawnSync('node', [conv, text, '--voice', voice, '--rate', rate, '--output', output], {
    encoding: 'utf-8',
    timeout: 300000,
  });
  if (r.status !== 0) throw new Error('Edge-TTS 失败: ' + (r.stderr || r.stdout || '').slice(-400));
  return { engine: 'edge', voice, file: output, bytes: fs.statSync(output).size };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.output) throw new Error('必须指定 --output <file.mp3>');
  let text = args.text;
  if (!text && !process.stdin.isTTY) {
    text = fs.readFileSync(0, 'utf-8').trim();
  }
  if (!text) throw new Error('缺少朗读文本（参数或 stdin）');
  if (text.length > 5000) throw new Error('单次文本过长（腾讯基础版单次上限约 1024 字），请分段');

  const info = args.engine === 'edge'
    ? await edgeTTS(text, args.edgeVoice, args.rate, args.output)
    : await tencentTTS(text, args.voice, args.output, {
        speed: args.speed,
        modelType: args.modelType,
        codec: args.codec,
      });
  console.log(`✓ ${info.engine}(${info.voice}) → ${info.file} (${(info.bytes / 1024).toFixed(0)}KB)`);
}

main().catch((e) => {
  console.error('✗', e.message);
  process.exit(1);
});
