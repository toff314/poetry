import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  X,
  Volume2,
  VolumeX,
  Clapperboard,
  RefreshCw,
  Shuffle,
  Maximize,
  Film,
  Hand,
} from 'lucide-react';
import { getGeneratedIndex, getGeneratedPoem } from '../lib/api';
import type { GeneratedPoem } from '../types';
import { fetchBgmTracks, rankBgm, bgmUrl, BGM_VOLUME } from '../lib/bgm';
import type { BgmTrack } from '../lib/bgm';
import { TRANSITIONS, getTransition } from '../lib/transitions';
import { transitionEngine } from '../lib/transitionEngine';

const MAX_POEMS = 10;
/** 单部片长限制：以背景音乐实际时长为准，夹在 1~5 分钟 */
const MIN_POEM_S = 60;
const MAX_POEM_S = 300;
/** 单幕最长停留（超出则在诗内循环多轮画面） */
const MAX_SCENE_S = 20;
const INTRO_MS = 5200;
const TRANSITION_KEY_STORAGE = 'poetry-cinema-transition';
const MODE_STORAGE = 'poetry-cinema-mode';

interface CinemaScene {
  image: string;
  caption: string;
}

interface CinemaProgramItem {
  id: string;
  title: string;
  author: string;
  dynasty: string;
  scenes: CinemaScene[];
  track: BgmTrack;
  /** 秒；0 = 元数据未就绪，先用兜底 */
  duration: number;
}

type Stage = 'lobby' | 'theater' | 'ending';
type CinemaMode = 'auto' | 'manual';

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function kbVariant(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return ['kb-zoom-in', 'kb-zoom-out', 'kb-pan-left', 'kb-pan-right'][h % 4];
}

async function buildProgram(): Promise<CinemaProgramItem[]> {
  const [index, tracks] = await Promise.all([getGeneratedIndex(), fetchBgmTracks()]);
  const candidates = (index.poems || []).filter((p) => p.hasArt);
  const picked = shuffle(candidates).slice(0, MAX_POEMS);
  const details = (await Promise.all(picked.map((p) => getGeneratedPoem(p.id).catch(() => null)))).filter(
    (g): g is GeneratedPoem => !!g && !!g.heroImage
  );
  const used = new Map<string, number>();
  return details.map((g) => {
    const text = `${g.title}${g.author}${g.content}`;
    const ranked = rankBgm(tracks, text);
    const track =
      ranked.find((t) => !used.has(t.id)) || ranked.find((t) => (used.get(t.id) || 0) < 2) || ranked[0];
    used.set(track.id, (used.get(track.id) || 0) + 1);
    const scenes: CinemaScene[] = [
      { image: g.heroImage, caption: `${g.title} · ${g.author}` },
      ...g.sections
        .filter((s) => typeof s.image === 'string' && s.image.startsWith('/generated/'))
        .map((s) => ({ image: s.image, caption: s.original })),
    ];
    return { id: g.id, title: g.title, author: g.author, dynasty: g.dynasty || '', scenes, track, duration: 0 };
  });
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

/* ── 放映厅 ─────────────────────────────────────────────── */
export default function Cinema() {
  const [stage, setStage] = useState<Stage>('lobby');
  const [program, setProgram] = useState<CinemaProgramItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [transitionKey, setTransitionKey] = useState<string>(() => {
    try {
      return localStorage.getItem(TRANSITION_KEY_STORAGE) || 'ink';
    } catch {
      return 'ink';
    }
  });
  const [mode, setMode] = useState<CinemaMode>(() => {
    try {
      return (localStorage.getItem(MODE_STORAGE) as CinemaMode) || 'auto';
    } catch {
      return 'auto';
    }
  });

  const loadProgram = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const items = await buildProgram();
      if (!items.length) {
        setError('还没有已完成 AI 电影化的诗作，先去沉浸画廊或诗词库制作几部吧。');
        setProgram([]);
        return;
      }
      setProgram(items);
      // 预载时长与画面（不阻塞入场）；同一 track 只探测一次，按 track.id 写回所有引用片目
      const uniqueTracks = new Map<string, BgmTrack>();
      items.forEach((it) => {
        if (!uniqueTracks.has(it.track.id)) uniqueTracks.set(it.track.id, it.track);
      });
      uniqueTracks.forEach((track) => {
        probeDuration(track).then((d) => {
          if (d > 0) {
            setProgram((prev) =>
              prev.map((x) => (x.track.id === track.id ? { ...x, duration: clamp(d, MIN_POEM_S, MAX_POEM_S) } : x))
            );
          }
        });
      });
      items.forEach((it) => it.scenes.forEach((s) => {
        const img = new Image();
        img.src = s.image;
      }));
    } catch {
      setError('排片失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProgram();
  }, [loadProgram]);

  useEffect(() => {
    try {
      localStorage.setItem(TRANSITION_KEY_STORAGE, transitionKey);
    } catch {}
  }, [transitionKey]);
  useEffect(() => {
    try {
      localStorage.setItem(MODE_STORAGE, mode);
    } catch {}
  }, [mode]);

  if (stage === 'theater' && program.length) {
    return (
      <Theater
        program={program}
        mode={mode}
        transitionKey={transitionKey}
        onModeChange={setMode}
        onExit={() => setStage('lobby')}
        onFinish={() => setStage('ending')}
      />
    );
  }

  if (stage === 'ending' && program.length) {
    return (
      <Ending
        program={program}
        onReplay={() => setStage('theater')}
        onReshuffle={() => {
          loadProgram();
          setStage('lobby');
        }}
        onLobby={() => setStage('lobby')}
      />
    );
  }

  return (
    <Lobby
      program={program}
      loading={loading}
      error={error}
      transitionKey={transitionKey}
      mode={mode}
      onTransitionChange={setTransitionKey}
      onModeChange={setMode}
      onReshuffle={loadProgram}
      onStart={() => setStage('theater')}
    />
  );
}

/* ── 前厅（排片 + 设置） ───────────────────────────────── */
function Lobby(props: {
  program: CinemaProgramItem[];
  loading: boolean;
  error: string;
  transitionKey: string;
  mode: CinemaMode;
  onTransitionChange: (k: string) => void;
  onModeChange: (m: CinemaMode) => void;
  onReshuffle: () => void;
  onStart: () => void;
}) {
  const { program, loading, error } = props;
  return (
    <div className="min-h-screen bg-ink pb-24 relative overflow-hidden">
      {/* 幕布氛围 */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(ellipse 90% 60% at 50% -10%, rgba(139,90,43,0.22), transparent 60%), linear-gradient(90deg, rgba(80,18,18,0.25), transparent 18%, transparent 82%, rgba(80,18,18,0.25))',
        }}
      />
      <section className="relative max-w-5xl mx-auto px-6 lg:px-10 pt-20 pb-10">
        <p className="text-xs tracking-[0.4em] text-gold uppercase mb-4 flex items-center gap-2">
          <Clapperboard size={14} /> Poetry Cinema
        </p>
        <h1 className="font-serif text-4xl md:text-5xl text-paper mb-4">放映厅</h1>
        <p className="text-silver max-w-2xl leading-relaxed">
          每场随机排定 {MAX_POEMS} 首诗，各配一支契合情绪的背景音乐。放映时长随乐句走，
          画面按乐句时长逐幕切换——自动放映是电影，手动欣赏是翻相册。
        </p>
      </section>

      <section className="relative max-w-5xl mx-auto px-6 lg:px-10">
        {/* 今日片单 */}
        <div className="rounded-xl border border-darkline bg-ink-light/60 backdrop-blur overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-darkline">
            <h2 className="font-serif text-lg text-paper flex items-center gap-2">
              <Film size={16} className="text-gold" /> 本场片单
            </h2>
            <button
              onClick={props.onReshuffle}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-xs text-silver hover:text-gold disabled:opacity-40 transition-colors"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              换一批
            </button>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-9 rounded bg-ink border border-darkline animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="p-10 text-center">
              <p className="text-silver mb-4">{error}</p>
              <Link
                to="/gallery"
                className="inline-flex items-center gap-2 bg-gold/15 text-gold border border-gold/40 px-5 py-2.5 rounded-lg text-sm hover:bg-gold/25 transition-colors"
              >
                去沉浸画廊看看
              </Link>
            </div>
          ) : (
            <ol className="divide-y divide-darkline/60">
              {program.map((it, i) => (
                <li key={it.id} className="flex items-center gap-4 px-5 py-3">
                  <span className="font-serif text-gold/70 text-sm w-7 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-paper truncate">《{it.title}》</p>
                    <p className="text-xs text-silver/70 truncate">
                      {it.author}
                      {it.dynasty ? ` · ${it.dynasty}` : ''}
                    </p>
                  </div>
                  <span className="hidden sm:inline text-xs text-silver/60 shrink-0">
                    配乐 · {it.track.title}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* 放映设置 */}
        <div className="mt-6 rounded-xl border border-darkline bg-ink-light/60 backdrop-blur p-5 space-y-5">
          <div>
            <p className="text-xs tracking-widest text-silver/70 mb-2">切换方式</p>
            <div className="flex flex-wrap gap-2">
              {TRANSITIONS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => props.onTransitionChange(t.key)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    props.transitionKey === t.key
                      ? 'bg-gold text-ink border-gold'
                      : 'border-darkline text-silver hover:border-silver'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs tracking-widest text-silver/70 mb-2">放映方式</p>
            <div className="flex gap-2">
              <button
                onClick={() => props.onModeChange('auto')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs rounded-full border transition-colors ${
                  props.mode === 'auto'
                    ? 'bg-gold text-ink border-gold'
                    : 'border-darkline text-silver hover:border-silver'
                }`}
              >
                <Play size={13} /> 自动放映 · 电影感
              </button>
              <button
                onClick={() => props.onModeChange('manual')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs rounded-full border transition-colors ${
                  props.mode === 'manual'
                    ? 'bg-gold text-ink border-gold'
                    : 'border-darkline text-silver hover:border-silver'
                }`}
              >
                <Hand size={13} /> 手动欣赏 · 自己翻
              </button>
            </div>
          </div>
          <button
            onClick={props.onStart}
            disabled={loading || !program.length}
            className="w-full inline-flex items-center justify-center gap-2 bg-gold text-ink px-6 py-3.5 rounded-lg font-medium hover:bg-gold/90 disabled:opacity-40 transition-colors"
          >
            <Play size={18} />
            {props.mode === 'auto' ? '熄灯 · 开始放映' : '入座 · 手动欣赏'}
          </button>
          <p className="text-[11px] text-silver/50 leading-relaxed">
            放映含背景音乐（进入后自动播放，导航栏音符可随时关闭）。朗诵人声需点击，请移步各诗的沉浸页。
          </p>
        </div>
      </section>
    </div>
  );
}

/* ── 放映厅（核心） ────────────────────────────────────── */
function Theater(props: {
  program: CinemaProgramItem[];
  mode: CinemaMode;
  transitionKey: string;
  onModeChange: (m: CinemaMode) => void;
  onExit: () => void;
  onFinish: () => void;
}) {
  const { program, mode } = props;
  const [poemIdx, setPoemIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [displayed, setDisplayed] = useState({ poem: 0, step: 0 });
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showIntro, setShowIntro] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [webglOk, setWebglOk] = useState(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const screenRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef(0);
  const transitioningRef = useRef(false);
  const displayedRef = useRef(displayed);
  displayedRef.current = displayed;
  const poemIdxRef = useRef(poemIdx);
  poemIdxRef.current = poemIdx;
  const stepTimerRef = useRef(0);
  const poemTimerRef = useRef(0);
  const controlsTimerRef = useRef(0);
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const gestureRetryCleanupRef = useRef<(() => void) | null>(null);

  const item = program[poemIdx];
  const sceneIdx = stepIdx % item.scenes.length;
  const displayedItem = program[displayed.poem];
  const displayedScene = displayed.step % displayedItem.scenes.length;

  const transitionDef = getTransition(props.transitionKey);
  const totalSteps = useMemo(() => {
    const d = item.duration || 120;
    const rounds = Math.max(1, Math.ceil(d / (item.scenes.length * MAX_SCENE_S)));
    return item.scenes.length * rounds;
  }, [item]);
  const stepMs = useMemo(() => ((item.duration || 120) * 1000) / totalSteps, [item, totalSteps]);

  /* WebGL 初始化 */
  useEffect(() => {
    const ok = transitionEngine.init(canvasRef.current);
    setWebglOk(ok);
    const onResize = () => {
      if (screenRef.current) {
        const r = screenRef.current.getBoundingClientRect();
        transitionEngine.resize(r.width, r.height);
      }
    };
    onResize();
    window.addEventListener('resize', onResize);
    const ro = new ResizeObserver(onResize);
    if (screenRef.current) ro.observe(screenRef.current);
    return () => {
      window.removeEventListener('resize', onResize);
      ro.disconnect();
      transitionEngine.destroy();
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  /* 画面预载 */
  useEffect(() => {
    const urls = program.flatMap((p) => p.scenes.map((s) => s.image));
    transitionEngine.preload(urls);
    urls.forEach((u) => {
      const img = new Image();
      img.src = u;
    });
  }, [program]);

  /* 幕间转场：运行 WebGL 逐帧渲染，结束后提交 displayed */
  const runTransition = useCallback(
    async (from: { poem: number; step: number }, to: { poem: number; step: number }) => {
      const def = getTransition(props.transitionKey);
      const fromImg = program[from.poem].scenes[from.step % program[from.poem].scenes.length].image;
      const toImg = program[to.poem].scenes[to.step % program[to.poem].scenes.length].image;
      if (def.duration <= 0 || !webglOk) {
        setDisplayed(to);
        return;
      }
      cancelAnimationFrame(rafRef.current);
      transitioningRef.current = true;
      const start = performance.now();
      const render = async (now: number) => {
        const t = Math.min(1, (now - start) / def.duration);
        const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        const ok = await transitionEngine.render(def, fromImg, toImg, eased);
        if (!ok) {
          transitioningRef.current = false;
          setDisplayed(to);
          return;
        }
        if (t < 1) {
          rafRef.current = requestAnimationFrame(render);
        } else {
          transitioningRef.current = false;
          setDisplayed(to);
          transitionEngine.clear();
        }
      };
      rafRef.current = requestAnimationFrame(render);
    },
    [program, props.transitionKey, webglOk]
  );

  /* 跳转：诗/幕的通用入口 */
  const goTo = useCallback(
    (poem: number, step: number) => {
      const p = clamp(poem, 0, program.length - 1);
      const total = program[p].scenes.length * Math.max(1, Math.ceil((program[p].duration || 120) / (program[p].scenes.length * MAX_SCENE_S)));
      let s = step;
      let pp = p;
      while (s >= total) {
        s -= total;
        pp += 1;
        if (pp >= program.length) {
          props.onFinish();
          return;
        }
      }
      while (s < 0) {
        pp -= 1;
        if (pp < 0) {
          pp = 0;
          s = 0;
          break;
        }
        const prevTotal = program[pp].scenes.length * Math.max(1, Math.ceil((program[pp].duration || 120) / (program[pp].scenes.length * MAX_SCENE_S)));
        s += prevTotal;
      }
      if (pp !== poemIdxRef.current) setPoemIdx(pp);
      setStepIdx(s);
      const from = displayedRef.current;
      const to = { poem: pp, step: s };
      setDisplayed(to);
      if (from.poem !== to.poem || from.step !== to.step) {
        if (!transitioningRef.current) runTransition(from, to);
      }
    },
    [program, runTransition, props]
  );

  const nextScene = useCallback(() => goTo(poemIdxRef.current, stepIdx + 1), [goTo, stepIdx]);
  const prevScene = useCallback(() => goTo(poemIdxRef.current, stepIdx - 1), [goTo, stepIdx]);
  const nextPoem = useCallback(() => {
    const p = poemIdxRef.current + 1;
    if (p >= program.length) {
      props.onFinish();
      return;
    }
    setPoemIdx(p);
    setStepIdx(0);
    const to = { poem: p, step: 0 };
    if (!transitioningRef.current) runTransition(displayedRef.current, to);
    setDisplayed(to);
  }, [program.length, runTransition, props]);

  /* 音频：随诗切换，驱动进度条 */
  useEffect(() => {
    const au = audioRef.current;
    if (!au) return;
    const myIdx = poemIdx;
    au.src = bgmUrl(item.track);
    au.loop = true;
    au.volume = BGM_VOLUME;
    const requestGestureRetry = () => {
      if (gestureRetryCleanupRef.current) return;
      const onGesture = () => {
        gestureRetryCleanupRef.current = null;
        if (playingRef.current && au.paused) au.play().catch(() => {});
      };
      window.addEventListener('pointerdown', onGesture, { once: true });
      window.addEventListener('keydown', onGesture, { once: true });
      gestureRetryCleanupRef.current = () => {
        window.removeEventListener('pointerdown', onGesture);
        window.removeEventListener('keydown', onGesture);
      };
    };
    if (playingRef.current) au.play().catch(requestGestureRetry);
    const onMeta = () => {
      const d = au.duration;
      if (Number.isFinite(d) && d > 0) {
        const clamped = clamp(d, MIN_POEM_S, MAX_POEM_S);
        setDuration(clamped);
        // 重排本部剩余时长（仅自动模式随乐句收幕）
        window.clearTimeout(poemTimerRef.current);
        if (modeRef.current !== 'auto') return;
        const remaining = clamped - au.currentTime;
        poemTimerRef.current = window.setTimeout(() => {
          if (playingRef.current && poemIdxRef.current === myIdx) nextPoem();
        }, Math.max(remaining, 5) * 1000);
      }
    };
    const onTime = () => {
      setProgress(au.currentTime);
      if (!duration && au.duration > 0) setDuration(clamp(au.duration, MIN_POEM_S, MAX_POEM_S));
    };
    au.addEventListener('loadedmetadata', onMeta);
    au.addEventListener('timeupdate', onTime);
    return () => {
      au.removeEventListener('loadedmetadata', onMeta);
      au.removeEventListener('timeupdate', onTime);
      window.clearTimeout(poemTimerRef.current);
      gestureRetryCleanupRef.current?.();
      gestureRetryCleanupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poemIdx, item.track.id]);

  /* 自动模式：逐幕定时 */
  useEffect(() => {
    window.clearTimeout(stepTimerRef.current);
    if (mode !== 'auto' || !playing) return;
    stepTimerRef.current = window.setTimeout(() => {
      const next = stepIdx + 1;
      const total = program[poemIdxRef.current].scenes.length * Math.max(1, Math.ceil((program[poemIdxRef.current].duration || 120) / (program[poemIdxRef.current].scenes.length * MAX_SCENE_S)));
      if (next >= total) {
        nextPoem();
      } else {
        setStepIdx(next);
        const from = displayedRef.current;
        const to = { poem: poemIdxRef.current, step: next };
        setDisplayed(to);
        if (!transitioningRef.current) runTransition(from, to);
      }
    }, stepMs);
    return () => window.clearTimeout(stepTimerRef.current);
  }, [mode, playing, stepIdx, stepMs, program, runTransition, nextPoem]);

  /* 片头卡 */
  useEffect(() => {
    setShowIntro(true);
    const t = window.setTimeout(() => setShowIntro(false), INTRO_MS);
    return () => window.clearTimeout(t);
  }, [poemIdx]);

  /* 控制条自动隐藏 */
  useEffect(() => {
    const show = () => {
      setControlsVisible(true);
      window.clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = window.setTimeout(() => setControlsVisible(false), 3200);
    };
    show();
    window.addEventListener('mousemove', show);
    return () => {
      window.removeEventListener('mousemove', show);
      window.clearTimeout(controlsTimerRef.current);
    };
  }, []);

  /* 键盘 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowRight') nextScene();
      else if (e.key === 'ArrowLeft') prevScene();
      else if (e.key === 'ArrowUp') prevPoem();
      else if (e.key === 'ArrowDown') nextPoem();
      else if (e.key === 'Escape') props.onExit();
      else if (e.key === 'm' || e.key === 'M') toggleMute();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextScene, prevScene, nextPoem, stepIdx]);

  const prevPoem = useCallback(() => {
    const p = Math.max(0, poemIdxRef.current - 1);
    setPoemIdx(p);
    setStepIdx(0);
    const to = { poem: p, step: 0 };
    if (!transitioningRef.current) runTransition(displayedRef.current, to);
    setDisplayed(to);
  }, [runTransition]);

  const togglePlay = useCallback(() => {
    const au = audioRef.current;
    setPlaying((prev) => {
      const next = !prev;
      if (au) {
        if (next) au.play().catch(() => {});
        else au.pause();
      }
      return next;
    });
  }, []);

  const toggleMute = useCallback(() => {
    const au = audioRef.current;
    setMuted((prev) => {
      if (au) au.muted = !prev;
      return !prev;
    });
  }, []);

  /* 触屏滑动 */
  const touchStartX = useRef(0);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) < 48) {
      setControlsVisible((v) => !v);
      return;
    }
    if (dx < 0) nextScene();
    else prevScene();
  };

  const enterFullscreen = () => {
    try {
      screenRef.current?.requestFullscreen?.().catch(() => {});
    } catch {
      // 不支持全屏则忽略
    }
  };

  const curScene = item.scenes[sceneIdx];

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      {/* 银幕 */}
      <div className="relative flex-1 flex items-center justify-center p-0 md:p-8">
        <div
          ref={screenRef}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className="relative w-full h-full md:w-auto md:aspect-video md:max-w-full md:max-h-full overflow-hidden bg-black select-none"
        >
          {/* 底层画面（Ken Burns） */}
          <img
            key={`${displayed.poem}-${displayedScene}`}
            src={displayedItem.scenes[displayedScene].image}
            alt=""
            draggable={false}
            className={`absolute inset-0 w-full h-full object-cover cinema-kb ${kbVariant(`${displayed.poem}-${displayedScene}`)}`}
          />
          {/* WebGL 转场层 */}
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
          {/* 颗粒 / 暗角 / 遮幅 */}
          <div className="absolute inset-0 pointer-events-none cinema-grain opacity-[0.05]" />
          <div className="absolute inset-0 pointer-events-none cinema-vignette" />
          <div className="absolute top-0 inset-x-0 h-[4%] bg-black pointer-events-none" />
          <div className="absolute bottom-0 inset-x-0 h-[4%] bg-black pointer-events-none" />

          {/* 字幕 */}
          <div className="absolute bottom-[8%] inset-x-0 flex justify-center pointer-events-none px-6">
            <p
              key={`cap-${poemIdx}-${sceneIdx}`}
              className="cinema-caption font-serif text-lg md:text-2xl text-paper/95 text-center leading-relaxed"
              style={{ textShadow: '0 2px 12px rgba(0,0,0,0.9)' }}
            >
              {curScene.caption}
            </p>
          </div>

          {/* 片头卡 */}
          {showIntro && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/35">
              <div className="text-center px-6">
                <p className="text-xs tracking-[0.5em] text-gold mb-4">
                  第 {poemIdx + 1} / {program.length} 部
                </p>
                <h2 className="font-serif text-3xl md:text-5xl text-paper mb-3">《{item.title}》</h2>
                <p className="text-sm text-paper/80">
                  {item.author}
                  {item.dynasty ? ` · ${item.dynasty}` : ''}
                </p>
                <p className="mt-4 text-xs text-silver/70">配乐 · {item.track.title}</p>
              </div>
            </div>
          )}

          {/* 左右点击区（手动模式） */}
          {mode === 'manual' && (
            <>
              <button
                className="absolute left-0 top-0 h-full w-1/3 opacity-0"
                aria-label="上一幕"
                onClick={prevScene}
              />
              <button
                className="absolute right-0 top-0 h-full w-1/3 opacity-0"
                aria-label="下一幕"
                onClick={nextScene}
              />
            </>
          )}
        </div>
      </div>

      {/* 控制条 */}
      <div
        className={`absolute bottom-0 inset-x-0 z-10 bg-gradient-to-t from-black/90 to-transparent px-4 md:px-10 pb-4 pt-10 transition-opacity duration-300 ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* 进度 */}
        <div className="max-w-4xl mx-auto mb-3">
          <div className="h-1 rounded bg-white/15 overflow-hidden">
            <div
              className="h-full bg-gold transition-[width] duration-300"
              style={{ width: `${duration ? clamp((progress / duration) * 100, 0, 100) : 0}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[11px] text-silver/70">
            <span>
              《{item.title}》 {item.author} · 第 {poemIdx + 1}/{program.length} 部
              {mode === 'manual' ? ` · 第 ${sceneIdx + 1}/${item.scenes.length} 幕` : ''}
            </span>
            <span>
              {Math.floor(progress / 60)}:{String(Math.floor(progress % 60)).padStart(2, '0')} /{' '}
              {Math.floor((duration || 0) / 60)}:{String(Math.floor((duration || 0) % 60)).padStart(2, '0')}
            </span>
          </div>
        </div>

        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <button onClick={props.onExit} className="p-2 text-silver hover:text-paper" title="退场 (Esc)" aria-label="退场">
              <X size={18} />
            </button>
            <button onClick={toggleMute} className="p-2 text-silver hover:text-paper" title="静音 (M)" aria-label="静音">
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button onClick={enterFullscreen} className="p-2 text-silver hover:text-paper" title="全屏" aria-label="全屏">
              <Maximize size={17} />
            </button>
            <span className="hidden md:inline text-[11px] text-silver/50 ml-1">
              转场 · {transitionDef.label}
              {!webglOk ? '（WebGL 不可用，已降级淡入淡出）' : ''}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button onClick={prevPoem} className="p-2 text-silver hover:text-paper" title="上一部 (↑)" aria-label="上一部">
              <SkipBack size={18} />
            </button>
            <button onClick={prevScene} className="p-2 text-silver hover:text-paper" title="上一幕 (←)" aria-label="上一幕">
              <ChevronLeft size={20} />
            </button>
            {mode === 'auto' && (
              <button
                onClick={togglePlay}
                className="p-2.5 rounded-full bg-gold text-ink hover:bg-gold/90"
                title={playing ? '暂停 (空格)' : '继续 (空格)'}
                aria-label={playing ? '暂停' : '继续'}
              >
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </button>
            )}
            <button onClick={nextScene} className="p-2 text-silver hover:text-paper" title="下一幕 (→)" aria-label="下一幕">
              <ChevronRight size={20} />
            </button>
            <button onClick={nextPoem} className="p-2 text-silver hover:text-paper" title="下一部 (↓)" aria-label="下一部">
              <SkipForward size={18} />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => props.onModeChange(mode === 'auto' ? 'manual' : 'auto')}
              className="px-3 py-1.5 text-xs rounded-full border border-white/20 text-silver hover:text-paper hover:border-silver transition-colors"
              title="切换放映方式"
            >
              {mode === 'auto' ? '自动放映中' : '手动欣赏中'}
            </button>
            <button
              onClick={() => {
                props.onExit();
              }}
              className="hidden md:inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-full border border-white/20 text-silver hover:text-paper hover:border-silver transition-colors"
              title="换一批片单"
            >
              <Shuffle size={12} />
              换片单
            </button>
          </div>
        </div>
      </div>

      <audio ref={audioRef} preload="auto" />
    </div>
  );
}

/* ── 谢幕 ─────────────────────────────────────────────── */
function Ending(props: {
  program: CinemaProgramItem[];
  onReplay: () => void;
  onReshuffle: () => void;
  onLobby: () => void;
}) {
  const totalS = props.program.reduce((sum, p) => sum + (p.duration || 120), 0);
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6 relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(139,90,43,0.18), transparent 65%)' }}
      />
      <div className="relative max-w-lg w-full text-center py-24">
        <p className="text-xs tracking-[0.6em] text-gold mb-6">CURTAIN</p>
        <h1 className="font-serif text-5xl text-paper mb-8">剧终</h1>
        <p className="text-silver text-sm mb-8">
          本场放映 {props.program.length} 部 · 约 {Math.round(totalS / 60)} 分钟
        </p>
        <ol className="text-left border-t border-b border-darkline divide-y divide-darkline/60 mb-10">
          {props.program.map((it, i) => (
            <li key={it.id} className="flex items-center gap-3 px-2 py-2.5">
              <span className="text-xs text-gold/60 w-6">{String(i + 1).padStart(2, '0')}</span>
              <span className="font-serif text-paper/90">《{it.title}》</span>
              <span className="text-xs text-silver/60">{it.author}</span>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={props.onReplay}
            className="inline-flex items-center gap-2 bg-gold text-ink px-6 py-3 rounded-lg text-sm font-medium hover:bg-gold/90 transition-colors"
          >
            <Play size={15} />
            原片单再映一场
          </button>
          <button
            onClick={props.onReshuffle}
            className="inline-flex items-center gap-2 border border-white/20 text-paper px-6 py-3 rounded-lg text-sm hover:border-gold hover:text-gold transition-colors"
          >
            <RefreshCw size={15} />
            排新片单
          </button>
          <button
            onClick={props.onLobby}
            className="inline-flex items-center gap-2 border border-white/20 text-paper px-6 py-3 rounded-lg text-sm hover:border-gold hover:text-gold transition-colors"
          >
            回放映厅
          </button>
        </div>
      </div>
    </div>
  );
}
