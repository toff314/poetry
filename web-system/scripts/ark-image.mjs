#!/usr/bin/env node
/**
 * ark-image.mjs — 火山方舟 Ark Seedream 统一生图（替代 doubao-cli）
 *
 * 用法:
 *   node scripts/ark-image.mjs "<prompt>" --out /path/out.jpg [--size 2K]
 *        [--watermark 0|1] [--ref-image <https图片url>] [--ref-asset <asset-xxxx>]
 *
 * 说明:
 *   - 模型：环境变量 SEED_IMG_MODEL，默认 doubao-seedream-4-5-251128
 *   - 产物：返回 24h 签名 URL → 下载 → PIL 统一转 1920 宽 JPEG（progressive）
 *   - 预留 --ref-image / --ref-asset：形象资产/参考图入图（参数结构按平台实验后启用）
 *   - 密钥：需要 ARK_API_KEY 在环境（由 server 或 .env 注入）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARK = `${process.env.ARK_API_BASE || 'https://ark.cn-beijing.volces.com/api'}/v3/images/generations`;
const MODEL = process.env.SEED_IMG_MODEL || 'doubao-seedream-4-5-251128';
const KEY = process.env.ARK_API_KEY || '';

function usage() {
  console.error('用法: node scripts/ark-image.mjs "<prompt>" --out <file> [--size 2K] [--watermark 0|1]');
  process.exit(1);
}
const argv = process.argv.slice(2);
const prompt = argv.find((a) => !a.startsWith('--')) || '';
const opt = (name) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : null;
};
const outFile = opt('--out');
if (!prompt || !outFile) usage();

async function main() {
  if (!KEY) { console.error('✗ 未配置 ARK_API_KEY'); process.exit(1); }

  const body = {
    model: MODEL,
    prompt,
    sequential_image_generation: 'disabled',
    response_format: 'url',
    size: opt('--size') || '2K',
    stream: false,
    watermark: opt('--watermark') === '1',
  };

  const res = await fetch(ARK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = {};
  try { json = JSON.parse(text); } catch { /* noop */ }
  if (!res.ok) {
    console.error(`✗ Ark ${res.status}: ${(json.error && (json.error.message || json.error.code)) || text.slice(0, 300)}`);
    process.exit(1);
  }
  const url = json.data?.[0]?.url;
  if (!url) { console.error('✗ 返回缺少 data[0].url'); process.exit(1); }

  // 下载 → 转 1920 JPEG（progressive）
  const img = await fetch(url);
  if (!img.ok) { console.error(`✗ 下载失败 HTTP ${img.status}`); process.exit(1); }
  const tmp = path.join(path.dirname(outFile), `.tmp-${Date.now()}.img`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(tmp, Buffer.from(await img.arrayBuffer()));

  const jpy = `from PIL import Image; import sys; im=Image.open(sys.argv[1]).convert('RGB');
w,h=im.size; nw=1920; im=im.resize((nw,int(h*nw/w)), Image.LANCZOS)
im.save(sys.argv[2],'JPEG',quality=88,optimize=True,progressive=True)`;
  const r = spawnSync('python3', ['-c', jpy, tmp, outFile], { encoding: 'utf-8', timeout: 120000 });
  fs.rmSync(tmp, { force: true });
  if (r.status !== 0) { console.error('✗ JPEG 转换失败: ' + (r.stderr || '').slice(-200)); process.exit(1); }
  console.log(`✓ ${outFile} (${MODEL}, size=${json.data?.[0]?.size || ''})`);
}

main().catch((e) => { console.error('✗', e); process.exit(1); });
