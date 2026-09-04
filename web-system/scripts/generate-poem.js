#!/usr/bin/env node
/**
 * 一键生成诗词沉浸式页面
 * 用法：node scripts/generate-poem.js <poem-id> [poet] [title] [content]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenCC from 'opencc-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = path.join(__dirname, '..', 'data', 'generated');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const converter = OpenCC.Converter({ from: 'tw', to: 'cn' });
const toSimple = (s) => (typeof s === 'string' ? converter(s) : s);

fs.mkdirSync(GENERATED_DIR, { recursive: true });

const [,, poemId, poetArg, titleArg, ...contentArgs] = process.argv;

if (!poemId) {
  console.error('Usage: node scripts/generate-poem.js <poem-id> [poet] [title] [content]');
  process.exit(1);
}

const content = contentArgs.join(' ');
const title = titleArg ? toSimple(titleArg) : `生成诗-${poemId.slice(0, 6)}`;
const author = poetArg ? toSimple(poetArg) : '未知诗人';
const poemContent = content ? toSimple(content) : `${title}内容待补充。`;

const firstLines = poemContent.split(/[。，；？！]/).filter(Boolean).slice(0, 4);
const definingLine = firstLines[0] || title;

function svgGradient(colors) {
  const stops = colors.map((c, i) => `<stop offset="${(i / (colors.length - 1)) * 100}%" stop-color="${c}"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">${stops}</linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/><rect width="1600" height="900" fill="rgba(10,10,11,0.3)"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

const palettes = [
  ['#0a0a0b', '#1a1410', '#3d2818', '#5c3a1e', '#8b5a2b'],
  ['#1c2420', '#3a4a42', '#5a7062', '#7a9080', '#2a332e'],
  ['#1a1a2e', '#3d3d5c', '#6b6b8a', '#9a9ab8', '#2a2a3e'],
  ['#1a2216', '#3a4a2e', '#5a6a46', '#8a9a6e', '#2a3222'],
  ['#2a1a10', '#5c3a1e', '#8b5a2b', '#b0803c', '#3a2618'],
  ['#0d0d12', '#1f1f2e', '#3a3a4a', '#5a5a6a', '#15151c'],
];

const sections = firstLines.slice(0, 4).map((line, i) => ({
  id: `scene-${i + 1}`,
  index: ['一', '二', '三', '四', '五', '六'][i],
  original: line,
  literal: '由 AI 流水线生成的直译，保留原文字面意义。',
  analysis: '此处为 AI 自动分析的写作手法与情绪功能，真实运行时可替换为 LLM 输出。',
  image: svgGradient(palettes[(i + 1) % palettes.length]),
}));

const generated = {
  id: poemId,
  title,
  author,
  dynasty: '古诗',
  content: poemContent,
  kicker: 'AI 沉浸式生成',
  definingLine,
  intro: `${title}由诗境 AI 流水线自动生成。系统将诗词按意象与情绪转折拆分为视觉段落，并配以电影感氛围图像。`,
  heroImage: svgGradient(palettes[0]),
  sections,
  closing: `${title}是一首由流水线处理的古典诗词。全诗通过 AI 分镜、直译、细读与氛围图，被转化为一次沉浸式的阅读体验。真实部署时，可接入 LLM 进行更深入的文学分析，并调用 doubao-cli 生成高质量画面。`,
};

fs.writeFileSync(path.join(GENERATED_DIR, `${poemId}.json`), JSON.stringify(generated, null, 2));

// Update index
const indexPath = path.join(GENERATED_DIR, 'index.json');
const index = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf-8')) : { poems: [] };
if (!index.poems.find((p) => p.id === poemId)) {
  index.poems.push({ id: poemId, title, author });
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
}

console.log(`Generated immersive page: ${path.join(GENERATED_DIR, `${poemId}.json`)}`);
