/**
 * 沉浸页「下载视频」：把单首诗按影院节奏实时渲染为 MP4。
 * 渲染管线：2D canvas（cover 绘制 + Ken Burns + 淡入淡出 + 字幕 + 遮幅/暗角），
 * 音频经 WebAudio BufferSource 混入 MediaStreamDestination，
 * 与 canvas.captureStream 一起进 MediaRecorder（优先 video/mp4，降级 webm）。
 * MediaRecorder 时间戳是实时的，因此逐帧按 performance.now 时间轴渲染即可音画同步。
 */
import type { GeneratedPoem } from '../types';
import type { BgmTrack } from './bgm';
import { bgmUrl } from './bgm';

export interface ExportScene {
  image: string;
  caption: string;
}

export interface ExportOptions {
  poem: GeneratedPoem;
  track: BgmTrack;
  onProgress?: (ratio: number) => void;
  signal?: AbortSignal;
}

export interface ExportResult {
  blob: Blob;
  ext: string;
  mime: string;
}

const W = 1280;
const H = 720;
const FPS = 30;

/** 与放映厅一致的单片节奏参数 */
const MIN_POEM_S = 60;
const MAX_POEM_S = 300;
const MAX_SCENE_S = 20;
const INTRO_MS = 4200;
const FADE_MS = 1200;
const OUTRO_MS = 1600;
const AUDIO_GAIN = 0.55;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function kbVariant(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return ['kb-zoom-in', 'kb-zoom-out', 'kb-pan-left', 'kb-pan-right'][h % 4];
}

export function buildExportScenes(poem: GeneratedPoem): ExportScene[] {
  const scenes: ExportScene[] = [{ image: poem.heroImage, caption: `${poem.title} · ${poem.author}` }];
  for (const s of poem.sections) {
    if (typeof s.image === 'string' && s.image) {
      scenes.push({ image: s.image, caption: s.original });
    }
  }
  return scenes;
}

function probeDuration(track: BgmTrack): Promise<number> {
  return new Promise((resolve) => {
    const a = new Audio();
    a.preload = 'metadata';
    const timer = window.setTimeout(() => {
      a.removeAttribute('src');
      resolve(0);
    }, 8000);
    a.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const d = a.duration;
      a.removeAttribute('src');
      resolve(Number.isFinite(d) ? d : 0);
    };
    a.onerror = () => {
      window.clearTimeout(timer);
      resolve(0);
    };
    a.src = bgmUrl(track);
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`画面加载失败：${url}`));
    img.src = url;
  });
}

function pickMime(): string {
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm',
  ];
  return candidates.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) || '';
}

interface FrameCtx {
  ctx: CanvasRenderingContext2D;
  imgs: HTMLImageElement[];
  scenes: ExportScene[];
  kbs: string[];
  stepMs: number;
  introEnd: number;
  totalMs: number;
  poem: GeneratedPoem;
  track: BgmTrack;
  vignette: CanvasGradient;
}

/** cover 绘制 + Ken Burns；p ∈ [0,1] 为该幕内的进度 */
function drawScene(f: FrameCtx, idx: number, p: number, alpha: number) {
  const { ctx, imgs, kbs } = f;
  const img = imgs[idx];
  if (!img || alpha <= 0) return;
  const cover = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  let scale = 1;
  let dx = 0;
  let dy = 0;
  switch (kbs[idx % kbs.length]) {
    case 'kb-zoom-in':
      scale = 1.04 + 0.1 * p;
      break;
    case 'kb-zoom-out':
      scale = 1.14 - 0.1 * p;
      break;
    case 'kb-pan-left':
      scale = 1.08;
      dx = 36 - 72 * p;
      break;
    case 'kb-pan-right':
      scale = 1.08;
      dx = -36 + 72 * p;
      break;
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(W / 2 + dx, H / 2 + dy);
  ctx.scale(cover * scale, cover * scale);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  ctx.restore();
}

function drawWrappedText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const ch of text) {
    if (ch === '\n') {
      lines.push(line);
      line = '';
      continue;
    }
    if (ctx.measureText(line + ch).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCaption(f: FrameCtx, text: string, alpha: number) {
  if (!text || alpha <= 0) return;
  const { ctx } = f;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '30px "LXGW WenKai", "STKaiti", "KaiTi", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(244,240,232,0.96)';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 2;
  const lines = drawWrappedText(ctx, text, W * 0.8);
  const lh = 46;
  const y0 = H * 0.84 - ((lines.length - 1) * lh) / 2;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y0 + i * lh));
  ctx.restore();
}

function drawLetterboxAndVignette(f: FrameCtx) {
  const { ctx, vignette } = f;
  ctx.save();
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H * 0.04);
  ctx.fillRect(0, H * 0.96, W, H * 0.04);
  ctx.restore();
}

function drawIntro(f: FrameCtx, t: number) {
  const { ctx, poem, track } = f;
  const p = clamp(t / INTRO_MS, 0, 1);
  const alpha = p < 0.2 ? p / 0.2 : p > 0.85 ? (1 - p) / 0.15 : 1;
  ctx.save();
  ctx.fillStyle = '#0a0a0b';
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(201,162,75,0.9)';
  ctx.font = '16px "LXGW WenKai", serif';
  ctx.fillText('诗 境 · 沉 浸 诗 词', W / 2, H * 0.34);
  ctx.fillStyle = 'rgba(244,240,232,0.98)';
  ctx.font = '64px "LXGW WenKai", "STKaiti", "KaiTi", serif';
  ctx.fillText(`《${poem.title}》`, W / 2, H * 0.48);
  ctx.fillStyle = 'rgba(244,240,232,0.75)';
  ctx.font = '24px "LXGW WenKai", serif';
  const sub = `${poem.author}${poem.dynasty ? ` · ${poem.dynasty}` : ''}`;
  ctx.fillText(sub, W / 2, H * 0.6);
  ctx.fillStyle = 'rgba(160,160,165,0.7)';
  ctx.font = '18px "LXGW WenKai", serif';
  ctx.fillText(`配乐 · ${track.title}`, W / 2, H * 0.68);
  ctx.restore();
}

/** 主时间轴渲染：t(ms) 自录制起点 */
function renderFrame(f: FrameCtx, t: number) {
  const { ctx, scenes, stepMs, introEnd, totalMs } = f;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  if (t < introEnd) {
    drawIntro(f, t);
    return;
  }

  const mt = t - introEnd;
  const n = scenes.length;
  const stepCount = Math.floor(mt / stepMs);
  const local = mt - stepCount * stepMs;
  const cur = stepCount % n;

  // 淡出结尾
  const remain = totalMs - t;
  const outroAlpha = remain < OUTRO_MS ? remain / OUTRO_MS : 1;

  if (local < FADE_MS) {
    const a = easeInOut(local / FADE_MS);
    if (stepCount > 0) drawScene(f, (stepCount - 1) % n, 1, 1 - a);
    drawScene(f, cur, local / stepMs, a);
    drawCaption(f, scenes[cur].caption, a * outroAlpha);
  } else {
    drawScene(f, cur, local / stepMs, 1);
    // 字幕在幕内前 0.6s 淡入，收尾前 0.8s 淡出
    const sinceFade = local - FADE_MS;
    const capA = Math.min(1, sinceFade / 600) * (stepMs - local < 800 ? Math.max(0, (stepMs - local) / 800) : 1);
    drawCaption(f, scenes[cur].caption, capA * outroAlpha);
  }
  drawLetterboxAndVignette(f);
  if (outroAlpha < 1) {
    ctx.save();
    ctx.globalAlpha = 1 - outroAlpha;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

export async function exportPoemVideo(opts: ExportOptions): Promise<ExportResult> {
  const { poem, track, onProgress, signal } = opts;
  const mime = pickMime();
  if (!mime) throw new Error('当前浏览器不支持视频录制（MediaRecorder）');
  if (typeof MediaRecorder === 'undefined') throw new Error('当前浏览器不支持视频录制');

  const scenes = buildExportScenes(poem).filter((s) => !!s.image);
  if (!scenes.length) throw new Error('这首诗还没有可用画面');

  // 等正文字体就绪，避免字幕/片头回退字体
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('64px "LXGW WenKai"'),
        document.fonts.load('30px "LXGW WenKai"'),
      ]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch { /* 字体加载失败不阻断 */ }

  const [durationS, imgs] = await Promise.all([
    probeDuration(track),
    Promise.all(scenes.map((s) => loadImage(s.image))),
  ]);
  if (signal?.aborted) throw new DOMException('aborted', 'AbortError');

  const mainS = clamp(durationS || 120, MIN_POEM_S, MAX_POEM_S);
  const rounds = Math.max(1, Math.ceil(mainS / (scenes.length * MAX_SCENE_S)));
  const stepCount = scenes.length * rounds;
  const stepMs = (mainS * 1000) / stepCount;
  const introEnd = INTRO_MS;
  const mainEnd = introEnd + mainS * 1000;
  const totalMs = mainEnd + OUTRO_MS;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D 不可用');

  const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.78);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.38)');

  const f: FrameCtx = {
    ctx,
    imgs,
    scenes,
    kbs: scenes.map((_, i) => kbVariant(`${poem.id}-${i}`)),
    stepMs,
    introEnd,
    totalMs,
    poem,
    track,
    vignette,
  };

  // 音频：整段 BGM 混入录制流
  const actx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const dest = actx.createMediaStreamDestination();
  let srcNode: AudioBufferSourceNode | null = null;
  try {
    const res = await fetch(bgmUrl(track));
    if (!res.ok) throw new Error('配乐下载失败');
    const buf = await actx.decodeAudioData(await res.arrayBuffer());
    srcNode = actx.createBufferSource();
    srcNode.buffer = buf;
    const gain = actx.createGain();
    gain.gain.value = AUDIO_GAIN;
    srcNode.connect(gain);
    gain.connect(dest);
  } catch (e) {
    void actx.close().catch(() => {});
    throw e instanceof Error && e.message ? e : new Error('配乐加载失败');
  }
  if (signal?.aborted) {
    void actx.close().catch(() => {});
    throw new DOMException('aborted', 'AbortError');
  }

  const stream = canvas.captureStream(FPS);
  dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));

  return new Promise<ExportResult>((resolve, reject) => {
    const chunks: BlobPart[] = [];
    let settled = false;
    const cleanup = () => {
      window.cancelAnimationFrame(raf);
      window.clearInterval(interval);
      stream.getTracks().forEach((tr) => tr.stop());
      void actx.close().catch(() => {});
      signal?.removeEventListener('abort', onAbort);
    };
    const fail = (e: unknown) => {
      if (settled) return;
      settled = true;
      try { srcNode?.stop(); } catch { /* 未启动 */ }
      cleanup();
      reject(e);
    };

    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
    } catch (e) {
      void actx.close().catch(() => {});
      reject(e);
      return;
    }
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onerror = () => fail(new Error('视频编码失败，请重试'));
    rec.onstop = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        blob: new Blob(chunks, { type: mime }),
        ext: mime.includes('mp4') ? 'mp4' : 'webm',
        mime,
      });
    };

    const onAbort = () => {
      try { srcNode?.stop(); } catch { /* 未启动 */ }
      try { rec.stop(); } catch { fail(new DOMException('aborted', 'AbortError')); }
    };
    signal?.addEventListener('abort', onAbort);

    // 首帧铺底后再启动录制，避免黑帧
    renderFrame(f, 0);
    rec.start(250);
    const t0 = performance.now();
    try {
      srcNode?.start(0);
    } catch { /* 已停止 */ }

    let raf = 0;
    let interval = 0;
    const tick = () => {
      const t = performance.now() - t0;
      renderFrame(f, Math.min(t, totalMs));
      onProgress?.(clamp(t / totalMs, 0, 1));
      if (t >= totalMs) {
        try { srcNode?.stop(); } catch { /* 已停止 */ }
        window.setTimeout(() => {
          try { rec.stop(); } catch { /* ignore */ }
        }, 120);
        return;
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    // 后台标签页 rAF 停摆时由 interval 兜底推进画面
    interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') return;
      const t = performance.now() - t0;
      if (t >= totalMs) return;
      renderFrame(f, Math.min(t, totalMs));
    }, 1000 / FPS);
  });
}
