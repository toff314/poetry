import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Sparkles, Play, Pause, RotateCcw, Square, Volume2,
  Music, Music2, SkipBack, SkipForward, Download,
} from 'lucide-react';
import { getGeneratedPoem, getPoemById, getRankByDb, findRankByTitle, tagText, getPoemVideo, uploadPoemVideo, type RankInfo } from '../lib/api';
import type { PoemVideoInfo } from '../lib/api';
import type { AudioVoice, GeneratedPoem } from '../types';
import { fetchBgmTracks, matchBgm, bgmUrl, BGM_VOLUME } from '../lib/bgm';
import type { BgmTrack } from '../lib/bgm';
import { exportPoemVideo, buildExportScenes } from '../lib/videoExport';
import DanmakuLayer from '../components/DanmakuLayer';
import TagPill from '../components/TagPill';
type ClosingBlock = { head: string; body: string };

function splitClosing(text: string): ClosingBlock[] {
  const blocks: ClosingBlock[] = [];
  const re = /【([^】]+)】([\s\S]*?)(?=【[^】]+】|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    blocks.push({ head: m[1].trim(), body: m[2].trim() });
  }
  if (blocks.length === 0) {
    const t = (text || '').trim();
    if (t) blocks.push({ head: '', body: t });
    return blocks;
  }
  const firstIdx = text.indexOf('【');
  const pre = firstIdx > 0 ? text.slice(0, firstIdx).trim() : '';
  if (pre) blocks.unshift({ head: '', body: pre });
  return blocks;
}

type PlayMode = 'idle' | 'playing' | 'paused';

function sceneAttr(cueScene: string): string {
  if (cueScene === 'hero') return '0';
  const m = /^scene-(\d+)$/.exec(cueScene);
  return m ? String(Number(m[1])) : cueScene;
}

function scrollToScene(attr: string) {
  const el = document.querySelector<HTMLElement>(`[data-scene="${attr}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const SILENT_STEP_MS = 8000;

export default function PoemDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [poem, setPoem] = useState<GeneratedPoem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genInfo, setGenInfo] = useState<{ progress: number; detail: string } | null>(null);
  const [genError, setGenError] = useState('');
  const [rank, setRank] = useState<RankInfo | null>(null);
  const [rawPoem, setRawPoem] = useState<{ author: string; title: string; content: string } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mode, setMode] = useState<PlayMode>('idle');
  const [voiceId, setVoiceId] = useState('');

  // 下载视频（配乐 + 画面切换，实时渲染为 MP4；产物缓存到 public，二次直接下载）
  const [exporting, setExporting] = useState(false);
  const [exportRatio, setExportRatio] = useState(0);
  const [exportPhase, setExportPhase] = useState<'render' | 'upload'>('render');
  const [exportErr, setExportErr] = useState('');
  const [cachedVideo, setCachedVideo] = useState<PoemVideoInfo | null>(null);
  const exportAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    getPoemVideo(id).then((v) => { if (alive) setCachedVideo(v); }).catch(() => {});
    return () => { alive = false; };
  }, [id]);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const stepRef = useRef(0);
  const segRef = useRef(0);
  const poemRef = useRef(poem);
  poemRef.current = poem;

  // 背景音乐（Suno BGM 模板库，按诗文情绪匹配）
  const [bgmTracks, setBgmTracks] = useState<BgmTrack[]>([]);
  const [bgmOn, setBgmOn] = useState(true);
  const [bgmIdx, setBgmIdx] = useState(-1); // -1 = 自动匹配
  const [bgmTitle, setBgmTitle] = useState('');
  const bgmIdxRef = useRef(-1);
  bgmIdxRef.current = bgmIdx;

  const voices: AudioVoice[] = poem?.audio?.voices || [];
  const voice = voices.find((v) => v.id === voiceId) || voices[0];
  const order = useMemo(() => ['hero', ...(poem?.sections || []).map((s) => s.id)], [poem]);
  const hasVoice = !!voice && order.length > 0;

  useEffect(() => {
    if (!poem?.audio) return;
    const def = poem.audio.defaultVoiceId || poem.audio.voices[0]?.id || '';
    setVoiceId(def);
  }, [poem]);

  // 载入曲库
  useEffect(() => {
    fetchBgmTracks().then(setBgmTracks).catch(() => setBgmTracks([]));
  }, []);

  // 载入榜单名次（三百首·第 N 位；dbId 未命中按题名兜底）
  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      let r = null;
      try { r = await getRankByDb(id); } catch { r = null; }
      if (!r && poem && poem.author) r = await findRankByTitle(poem.author, poem.title);
      if (alive) setRank(r);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, poem?.author, poem?.title]);

  // 诗文变化时重置 BGM
  useEffect(() => {
    const bgm = bgmRef.current;
    if (bgm) {
      bgm.pause();
      try { bgm.currentTime = 0; } catch {}
    }
    setBgmTitle('');
    setBgmIdx(-1);
  }, [id]);

  const poemText = useMemo(() => {
    const p = poemRef.current;
    if (!p) return '';
    return `${p.title}${p.author}${p.kicker}${p.content}`;
  }, [poem]);

  const currentTrack = useMemo(() => {
    if (!bgmTracks.length) return null;
    if (bgmIdx >= 0 && bgmIdx < bgmTracks.length) return bgmTracks[bgmIdx];
    if (poemRef.current) return matchBgm(bgmTracks, poemText);
    return bgmTracks[0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgmTracks, bgmIdx, poemText]);

  const playBgm = useCallback(() => {
    const bgm = bgmRef.current;
    if (!bgm || !bgmOn || !currentTrack) return;
    bgm.volume = BGM_VOLUME;
    bgm.loop = true;
    bgm.src = bgmUrl(currentTrack);
    setBgmTitle(currentTrack.title);
    bgm.play().catch(() => setBgmTitle(''));
  }, [bgmOn, currentTrack]);

  // 曲目文件缺失时跳过到下一首
  useEffect(() => {
    const bgm = bgmRef.current;
    if (!bgm) return;
    const onError = () => {
      if (bgmTracks.length <= 1) {
        setBgmTitle('');
        return;
      }
      const cur = bgmIdxRef.current >= 0 ? bgmIdxRef.current : 0;
      const next = (cur + 1) % bgmTracks.length;
      setBgmIdx(next);
      setBgmTitle(bgmTracks[next].title);
      bgm.src = bgmUrl(bgmTracks[next]);
      bgm.play().catch(() => setBgmTitle(''));
    };
    bgm.addEventListener('error', onError);
    return () => bgm.removeEventListener('error', onError);
  }, [bgmTracks]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    setRawPoem(null);
    getGeneratedPoem(id)
      .then(setPoem)
      .catch(() => {
        setError('not-generated');
        findRawPoem(id)
          .then(setRawPoem)
          .catch(() => setRawPoem(null));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const handleScroll = () => {
      const sections = document.querySelectorAll<HTMLElement>('[data-scene]');
      let closest = 0;
      let minDist = Infinity;
      sections.forEach((sec, i) => {
        const dist = Math.abs(sec.getBoundingClientRect().top - window.innerHeight * 0.3);
        if (dist < minDist) {
          minDist = dist;
          closest = i;
        }
      });
      setActiveIndex(closest);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [poem]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopBgm = useCallback(() => {
    const bgm = bgmRef.current;
    if (bgm) {
      bgm.pause();
      try { bgm.currentTime = 0; } catch {}
    }
    setBgmTitle('');
  }, []);

  const stopAll = useCallback(() => {
    clearTimer();
    const au = audioRef.current;
    if (au) {
      au.pause();
      try { au.currentTime = 0; } catch {}
    }
    segRef.current = 0;
    setMode('idle');
  }, [clearTimer]);

  useEffect(() => () => {
    stopAll();
    stopBgm();
  }, [stopAll, stopBgm]);

  // 逐段播放：朗读一段 -> 滚动到下一场景 -> 播下一段
  const playSeg = useCallback(
    (index: number) => {
      const au = audioRef.current;
      const v = poemRef.current?.audio?.voices.find((x) => x.id === voiceId) || poemRef.current?.audio?.voices[0];
      if (!au || !v) return;
      if (index >= order.length) {
        setMode('idle');
        return;
      }
      segRef.current = index;
      const sceneId = order[index];
      const url = v.scenes[sceneId];
      if (!url) {
        playSeg(index + 1);
        return;
      }
      scrollToScene(sceneAttr(sceneId));
      au.src = url;
      au.play().then(() => setMode('playing')).catch(() => setMode('idle'));
    },
    [order, voiceId]
  );

  const startPlayback = useCallback(() => {
    setMode('playing');
    scrollToScene('0');
    if (bgmOn) playBgm();
    window.setTimeout(() => playSeg(0), 120);
  }, [playSeg, bgmOn, playBgm]);

  // 静音自动放映
  const startSilent = useCallback(() => {
    const total = (poemRef.current?.sections.length ?? 0) + 1;
    stepRef.current = 0;
    scrollToScene('0');
    if (bgmOn) playBgm();
    clearTimer();
    timerRef.current = window.setInterval(() => {
      stepRef.current += 1;
      if (stepRef.current > total) {
        stopAll();
        return;
      }
      scrollToScene(String(stepRef.current));
    }, SILENT_STEP_MS);
  }, [bgmOn, playBgm, clearTimer, stopAll]);

  const handleMain = useCallback(() => {
    const au = audioRef.current;
    if (mode === 'playing') {
      if (au) au.pause();
      clearTimer();
      setMode('paused');
      return;
    }
    if (mode === 'paused' && au) {
      au.play().then(() => setMode('playing')).catch(() => {});
      return;
    }
    if (hasVoice) {
      startPlayback();
    } else {
      startSilent();
    }
  }, [mode, hasVoice, clearTimer, startPlayback, startSilent]);

  useEffect(() => {
    const au = audioRef.current;
    if (!au) return;
    const onEnded = () => {
      if (mode !== 'playing') return;
      playSeg(segRef.current + 1);
    };
    au.addEventListener('ended', onEnded);
    return () => au.removeEventListener('ended', onEnded);
  }, [mode, playSeg]);

  useEffect(() => {
    if (mode !== 'playing' || hasVoice) return;
    const cancel = () => stopAll();
    window.addEventListener('wheel', cancel, { passive: true });
    window.addEventListener('touchstart', cancel, { passive: true });
    return () => {
      window.removeEventListener('wheel', cancel);
      window.removeEventListener('touchstart', cancel);
    };
  }, [mode, hasVoice, stopAll]);

  const handleVoiceChange = (v: string) => {
    const wasPlaying = mode === 'playing' || mode === 'paused';
    setVoiceId(v);
    stopAll();
    if (wasPlaying) {
      window.setTimeout(() => playSeg(0), 80);
    }
  };

  const handleBgmToggle = () => {
    if (bgmOn) {
      stopBgm();
      setBgmOn(false);
    } else {
      setBgmOn(true);
      // 若正在朗读/放映则立即起配乐（有用户手势）
      if (mode === 'playing' || mode === 'paused') playBgm();
    }
  };

  const handleBgmSkip = (dir: 1 | -1) => {
    if (!bgmTracks.length) return;
    const base = bgmIdx >= 0 ? bgmIdx : 0;
    const next = (base + dir + bgmTracks.length) % bgmTracks.length;
    setBgmIdx(next);
    if (bgmOn) {
      window.setTimeout(playBgm, 0);
    }
  };

  const canExport = (!!cachedVideo || (!!poem && !!currentTrack && buildExportScenes(poem).length > 0)) && !generating;

  const triggerDownload = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleExport = async () => {
    if (!poem || exporting || !canExport) return;
    // 已缓存：直接下载产物，不再渲染
    if (cachedVideo) {
      triggerDownload(cachedVideo.url, `${poem.title}.${cachedVideo.ext}`);
      return;
    }
    if (!currentTrack) return;
    stopAll();
    stopBgm();
    setExporting(true);
    setExportRatio(0);
    setExportPhase('render');
    setExportErr('');
    const ac = new AbortController();
    exportAbortRef.current = ac;
    try {
      const { blob, ext } = await exportPoemVideo({
        poem,
        track: currentTrack,
        onProgress: setExportRatio,
        signal: ac.signal,
      });
      const localUrl = URL.createObjectURL(blob);
      triggerDownload(localUrl, `${poem.title}.${ext}`);
      window.setTimeout(() => URL.revokeObjectURL(localUrl), 10_000);
      // 上传到 public 产物目录：下次任何访客直接下载
      setExportPhase('upload');
      try {
        const info = await uploadPoemVideo(poem.id, blob);
        setCachedVideo(info);
      } catch (e) {
        setExportErr(e instanceof Error && e.message ? `视频已本地下载；缓存失败：${e.message}` : '视频已本地下载；服务器缓存失败');
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setExportErr(e instanceof Error && e.message ? e.message : '视频生成失败，请重试');
      }
    } finally {
      setExporting(false);
      exportAbortRef.current = null;
    }
  };

  const cancelExport = () => {
    exportAbortRef.current?.abort();
  };

  useEffect(() => () => {
    exportAbortRef.current?.abort();
  }, []);

  const handleGenerate = async () => {
    if (!id || generating) return;
    setGenerating(true);
    setGenInfo({ progress: 0, detail: '排队中…' });
    setGenError('');
    try {
      const res = await fetch('/api/generate-ai/' + encodeURIComponent(id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice: 'edge-yunjian' }),
      });
      if (!res.ok) {
        let msg = '启动失败';
        try { const e = await res.json(); if (e && e.error) msg = e.error; } catch { /* ignore */ }
        throw new Error(msg);
      }
      const t = await res.json();
      const taskId = t.taskId || id;
      // 轮询任务（最长约 12 分钟）
      for (let i = 0; i < 360; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const sr = await fetch('/api/generate-ai/' + encodeURIComponent(taskId));
        if (!sr.ok) continue;
        const st = await sr.json();
        setGenInfo({ progress: st.progress || 0, detail: st.detail || st.stage || '生成中…' });
        if (st.status === 'done' && id) {
          const generated = await getGeneratedPoem(id);
          setPoem(generated);
          setError('');
          setGenInfo(null);
          setGenerating(false);
          return;
        }
        if (st.status === 'error') {
          setGenError(st.error || '生成失败，请重试');
          setGenInfo(null);
          setGenerating(false);
          return;
        }
      }
      setGenError('生成超时，可稍后重试');
      setGenInfo(null);
      setGenerating(false);
    } catch (e) {
      setGenError(e instanceof Error && e.message ? e.message : '生成请求失败，请重试');
      setGenInfo(null);
      setGenerating(false);
    }
  };

  const backToPrev = () => {
    if (window.history.length > 1) window.history.back();
    else navigate('/library');
  };

  async function findRawPoem(poemId: string): Promise<{ author: string; title: string; content: string } | null> {
    try {
      const res = await getPoemById(poemId);
      const p = res?.data?.poem;
      if (!p) return null;
      return { author: p.author || '', title: p.title || '', content: p.content || '' };
    } catch {
      return null;
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink">
        <Loader2 className="animate-spin text-gold" size={32} />
      </div>
    );
  }

  if (error === 'not-generated' && !poem) {
  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-6 py-24">
      <DanmakuLayer poemId={id || ''} />
      <div className="max-w-2xl w-full">          <button onClick={backToPrev} className="inline-flex items-center gap-2 text-sm text-silver hover:text-gold transition-colors mb-10">
            <ArrowLeft size={16} />
            返回上一页
          </button>
          <p className="text-xs tracking-[0.3em] text-gold uppercase mb-4">AI Immersive · 尚未制作</p>
          <h1 className="font-serif text-4xl md:text-5xl text-paper mb-3">{rawPoem?.title || '这首诗'}</h1>
          {rawPoem?.author && (
            <div className="flex items-center gap-2 mb-8 flex-wrap">
              <p className="text-silver">{rawPoem.author}</p>
              <TagPill dbId={id} author={rawPoem.author} title={rawPoem.title} />
            </div>
          )}
          {rawPoem ? (
            <div className="max-h-[46vh] overflow-y-auto pr-2 rounded-xl border border-darkline bg-ink-light/50 p-6 mb-10">
              <p className="font-serif text-lg leading-loose text-paper/90 whitespace-pre-wrap poem-text">{rawPoem.content}</p>
            </div>
          ) : (
            <div className="mb-10 text-silver text-sm">正在取回原诗…</div>
          )}
          <p className="text-silver/80 text-sm mb-6 max-w-lg leading-relaxed">
            这首诗还没有电影页。点击下方按钮，用 AI 为它生成画面、逐段直译与解读。
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 bg-gold text-ink px-6 py-3 rounded-lg text-sm font-medium hover:bg-gold/90 disabled:opacity-60"
            >
              {generating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
              {generating ? (genInfo ? `${genInfo.detail || 'AI 制作中…'} ${genInfo.progress}%` : 'AI 制作中…') : '用 AI 生成沉浸页（图 + 朗诵）'}
            </button>
          </div>
          {genError && (
            <p className="mt-5 text-sm text-red-400 max-w-lg leading-relaxed">
              {genError}
            </p>
          )}
          {generating && !genError && (
            <p className="mt-5 text-xs text-silver/70 max-w-lg leading-relaxed">
              完整流水线：AI 逐场景生成画面（约 1 分钟/张）→ 配云健分段朗诵 → 组装页面。完成后将自动进入沉浸页，可在本页停留等待。
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!poem) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink text-silver">
        页面加载失败
      </div>
    );
  }

  const allImages = [poem.heroImage, ...poem.sections.map((s) => s.image)];
  const label =
    mode === 'playing'
      ? hasVoice
        ? '暂停朗读'
        : '暂停放映'
      : mode === 'paused'
        ? '继续'
        : hasVoice
          ? '朗读放映'
          : '自动放映';

  return (
    <div className="relative">
      <DanmakuLayer poemId={id || ''} />
      <audio ref={audioRef} preload="auto" />
      <audio ref={bgmRef} preload="auto" loop />

      {/* Fixed image stage */}
      <div ref={stageRef} className="fixed inset-0 z-0 bg-ink">
        {allImages.map((src, i) => (
          <img
            key={src + i}
            src={src}
            alt=""
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[1400ms] ${i === activeIndex ? 'opacity-100 hero-kb' : 'opacity-0'}`}
          />
        ))}
        <div className="absolute inset-0 image-overlay" />
      </div>

      {/* Navigation */}
      <div className="fixed top-20 left-6 lg:left-10 z-40">
        <Link
          to="/library"
          className="inline-flex items-center gap-2 text-sm text-paper/80 hover:text-gold transition-colors"
        >
          <ArrowLeft size={16} />
          返回诗词库
        </Link>
      </div>

      {/* 播放控制条 */}
      <div className="fixed top-20 right-4 lg:right-8 z-40 flex items-center gap-1.5">
        {/* BGM 组 */}
        <div className="flex items-center gap-1 rounded-full bg-ink-light/80 border border-white/15 backdrop-blur-md px-1.5 py-1">
          <button
            onClick={handleBgmToggle}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
              bgmOn && bgmTitle ? 'text-gold' : bgmOn ? 'text-paper' : 'text-silver/50'
            }`}
            title={bgmOn ? '关闭背景乐' : '开启背景乐'}
            aria-label="背景音乐开关"
          >
            {bgmOn ? <Music2 size={14} /> : <Music size={14} />}
            {bgmTitle ? (
              <span className="max-w-[7rem] truncate">{bgmTitle}</span>
            ) : (
              <span className="hidden md:inline">背景乐</span>
            )}
          </button>
          {bgmOn && bgmTracks.length > 0 && (
            <>
              <button onClick={() => handleBgmSkip(-1)} className="px-1 py-1 text-silver hover:text-paper" title="上一首" aria-label="上一首">
                <SkipBack size={13} />
              </button>
              <button onClick={() => handleBgmSkip(1)} className="px-1 py-1 text-silver hover:text-paper" title="下一首" aria-label="下一首">
                <SkipForward size={13} />
              </button>
            </>
          )}
        </div>

        <button
          onClick={handleExport}
          disabled={!canExport || exporting}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs bg-ink-light/80 border border-white/15 text-silver hover:text-paper hover:border-gold/50 backdrop-blur-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title={cachedVideo ? '已生成过，直接下载' : canExport ? '渲染并下载（首次约 1~5 分钟，之后秒下）' : '需生成画面与配乐曲库就绪'}
        >
          <Download size={13} />
          下载视频
        </button>
        {voices.length > 1 && (
          <select
            value={voice?.id || ''}
            onChange={(e) => handleVoiceChange(e.target.value)}
            className="bg-ink-light/90 border border-white/15 text-xs text-paper rounded-full px-3 py-2 outline-none focus:border-gold/60 backdrop-blur-md"
            aria-label="选择朗读者"
            title="选择朗读者"
          >
            {voices.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        )}
        <button
          onClick={handleMain}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium backdrop-blur-md border transition-colors ${
            mode === 'playing'
              ? 'bg-gold text-ink border-gold'
              : 'bg-ink-light/80 border-white/15 text-paper hover:border-gold/60'
          }`}
        >
          {mode === 'playing' ? <Pause size={15} /> : <Play size={15} />}
          {label}
        </button>
        {hasVoice && mode === 'idle' && (
          <span className="hidden lg:inline-flex items-center gap-1.5 text-[10px] text-silver/70">
            <Volume2 size={12} /> {voice?.engine === 'tencent' ? '腾讯云' : 'Edge Neural'}
          </span>
        )}
        {mode !== 'idle' && (
          <button
            onClick={stopAll}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs bg-ink-light/80 border border-white/15 text-silver hover:text-paper hover:border-gold/50 backdrop-blur-md transition-colors"
            title="停止"
          >
            <Square size={12} />
          </button>
        )}
        <button
          onClick={() => { stopAll(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs bg-ink-light/80 border border-white/15 text-silver hover:text-paper hover:border-gold/50 backdrop-blur-md transition-colors"
          title="回到顶部"
        >
          <RotateCcw size={12} />
        </button>
      </div>

      {/* 视频导出：实时渲染进度（录制时长 = 成片时长，请勿切走） */}
      {exporting && (
        <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-center justify-center px-6">
          <div className="w-full max-w-md rounded-xl border border-darkline bg-ink-light/90 p-8 text-center">
            <p className="text-xs tracking-[0.3em] text-gold uppercase mb-4">Exporting Video</p>
            <h2 className="font-serif text-2xl text-paper mb-6">
              {exportPhase === 'upload' ? '正在保存到服务器…' : `正在生成《${poem.title}》视频`}
            </h2>
            <div className="h-1.5 rounded bg-white/10 overflow-hidden mb-3">
              <div
                className={`h-full bg-gold transition-[width] duration-500 ${exportPhase === 'upload' ? 'animate-pulse' : ''}`}
                style={{ width: `${exportPhase === 'upload' ? 100 : Math.round(exportRatio * 100)}%` }}
              />
            </div>
            <p className="text-sm text-silver mb-1">{exportPhase === 'upload' ? '100%' : `${Math.round(exportRatio * 100)}%`}</p>
            <p className="text-xs text-silver/60 leading-relaxed mb-6">
              {exportPhase === 'upload'
                ? '生成一次永久缓存，下次任何人进入本页都可秒下。'
                : `配乐 · ${currentTrack?.title}。实时渲染中（成片约 1~5 分钟），请保持本页在前台，不要关闭。`}
            </p>
            {exportPhase === 'render' && (
              <button
                onClick={cancelExport}
                className="inline-flex items-center gap-2 border border-white/20 text-paper px-5 py-2 rounded-lg text-sm hover:border-gold hover:text-gold transition-colors"
              >
                取消
              </button>
            )}
          </div>
        </div>
      )}

      {/* 导出失败提示 */}
      {exportErr && !exporting && (
        <div className="fixed bottom-6 inset-x-0 z-[70] flex justify-center px-6 pointer-events-none">
          <p className="rounded-lg border border-red-400/40 bg-ink-light/95 text-red-300 text-sm px-5 py-3 backdrop-blur-md">
            {exportErr}
          </p>
        </div>
      )}

      {/* Scroll content */}
      <main className="relative z-10">
        {/* Hero */}
        <section data-scene="0" className="min-h-screen flex items-start pt-[22vh] px-6 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-xs tracking-[0.3em] text-gold uppercase mb-6">{poem.kicker}</p>
            <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-medium text-paper leading-[1.1] mb-6">
              {poem.title}
            </h1>
            <p className="text-xl text-paper/80 mb-2">{poem.author} · {poem.dynasty}</p>
            {rank && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-gold border border-gold/40 rounded-full px-3 py-1 mb-4 bg-black/30 backdrop-blur-sm">
                {tagText(rank, true)}
              </span>
            )}
            <blockquote className="mt-8 pl-6 border-l-2 border-gold font-serif text-2xl md:text-3xl text-gold leading-relaxed">
              {poem.definingLine}
            </blockquote>
            <p className="mt-8 text-lg text-silver leading-relaxed max-w-lg">{poem.intro}</p>
          </div>
        </section>

        {/* Sections */}
        {poem.sections.map((section, index) => (
          <section
            key={section.id}
            data-scene={String(index + 1)}
            className={`min-h-[115vh] flex items-center px-6 lg:px-10 ${index % 2 === 1 ? 'justify-end' : 'justify-start'}`}
          >
            <article className="w-full max-w-xl p-8 lg:p-10 bg-ink-light/80 backdrop-blur-md border border-white/10 rounded-xl">
              <p className="text-xs tracking-[0.3em] text-gold uppercase mb-4">{section.index}</p>
              <h2 className="font-serif text-2xl md:text-4xl text-paper leading-relaxed mb-6 poem-text">
                {section.original}
              </h2>
              <p className="text-gold leading-relaxed mb-4">{section.literal}</p>
              <p className="text-silver leading-loose text-sm">{section.analysis}</p>
            </article>
          </section>
        ))}

        {/* Closing */}
        <section data-scene={String(poem.sections.length + 1)} className="min-h-screen flex items-center px-6 lg:px-10">
          <article className="w-full max-w-3xl p-8 lg:p-12 bg-ink-light/80 backdrop-blur-md border border-white/10 rounded-xl">
            <h2 className="font-serif text-3xl text-paper mb-8">读诗札记</h2>
            <div className="space-y-6">
              {splitClosing(poem.closing).map((b, i) => (
                <div key={i}>
                  {b.head && (
                    <p className="text-gold text-sm font-medium tracking-wider mb-2 border-l-2 border-gold/50 pl-3">
                      {b.head}
                    </p>
                  )}
                  <p className="text-silver leading-loose text-base md:text-lg whitespace-pre-wrap">{b.body}</p>
                </div>
              ))}
            </div>
            <Link
              to="/library"
              className="inline-flex items-center gap-2 mt-10 text-sm text-gold hover:underline"
            >
              <ArrowLeft size={16} />
              继续探索诗词库
            </Link>
          </article>
        </section>
      </main>
    </div>
  );
}