import { useCallback, useEffect, useRef, useState } from 'react';
import { Film, Loader2, Play, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { startVideoTask, getVideoTask, getPoemAvatar } from '../lib/api';
import type { VideoTask, PoemAvatar } from '../lib/api';

const POLL_MS = 5000;

const CLIP_LABEL: Record<string, string> = {
  hero: '定场 · 全诗意境',
};

export default function VideoPanel({ poemId }: { poemId: string }) {
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState<VideoTask | null>(null);
  const [starting, setStarting] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [cast, setCast] = useState<PoemAvatar | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const poemRef = useRef(poemId);
  poemRef.current = poemId;

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchOnce = useCallback(async () => {
    try {
      const t = await getVideoTask(poemRef.current);
      setTask(t);
      return t;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    return stopPoll;
  }, [stopPoll]);
  useEffect(() => {
    let disposed = false;
    getPoemAvatar(poemRef.current).then((res) => { if (!disposed) setCast(res?.data || null); }).catch(() => {});
    return () => { disposed = true; };
  }, [poemId]);


  const start = async () => {
    setStarting(true);
    setActionMsg('');
    try {
      await startVideoTask(poemRef.current);
      await fetchOnce();
      setActionMsg('视频任务已提交，正在排队生成（每段约 1–3 分钟）…');
      stopPoll();
      pollRef.current = setInterval(fetchOnce, POLL_MS);
    } catch (e) {
      setActionMsg(`无法开始：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setStarting(false);
    }
  };

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      const t = await fetchOnce();
      const running = t && (t.status === 'running' || t.status === 'partial');
      if (running) {
        stopPoll();
        pollRef.current = setInterval(fetchOnce, POLL_MS);
      }
    } else {
      stopPoll();
    }
  };

  if (!poemId) return null;

  const clips = task?.clips || [];
  const isBusy = task?.status === 'running' || task?.status === 'partial';
  const doneClips = clips.filter((c) => c.status === 'done');
  const failClips = clips.filter((c) => c.status === 'failed');

  return (
    <>
      <button
        onClick={toggle}
        title="把这首诗的每幅画面各生成一段视频"
        className={`fixed bottom-6 left-6 z-50 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium backdrop-blur-md transition-colors ${
          open ? 'bg-gold/15 text-gold border-gold/50' : 'bg-ink-light/90 text-silver border-darkline hover:border-silver'
        }`}
      >
        <Film size={14} />
        {isBusy ? '视频生成中…' : '生成视频'}
        {isBusy && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-60" /><span className="relative inline-flex rounded-full h-2 w-2 bg-gold" /></span>}
      </button>

      {open && (
        <div className="fixed bottom-16 left-6 z-50 w-[min(360px,calc(100vw-3rem))] bg-ink-light/97 border border-darkline rounded-2xl p-4 shadow-2xl backdrop-blur-md flex flex-col max-h-[60vh]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs tracking-widest text-gold uppercase">AI 视频 · 一图一景</p>
            <button onClick={toggle} className="text-silver hover:text-paper" aria-label="收起">
              <X size={16} />
            </button>
          </div>

          {clips.length > 0 && (
            <p className="text-xs text-silver/80 mb-2 flex items-center justify-between">
              <span>
                {doneClips.length}/{clips.length} 段完成{task?.detail ? ` · ${task.detail}` : ''}
              </span>
              {task?.progress != null && task.progress > 0 && task.progress < clips.length && (
                <Loader2 size={13} className="animate-spin text-gold" />
              )}
            </p>
          )}

          {cast && (cast.main || (cast.supports || []).length > 0) && (
            <p className="text-[11px] text-silver/85 leading-relaxed mb-2 border border-darkline/60 rounded-lg px-2.5 py-1.5">
              {cast.author && <span className="text-paper/80">{cast.author} · </span>}
              出演：<span className="text-gold">{cast.main?.occupation || '默认形象'}{cast.main?.age ? `（${cast.main.age}岁${cast.main.gender ? ' ' + cast.main.gender : ''}${cast.main.temperament ? ' · ' + cast.main.temperament : ''}）` : ''}</span>
              {(cast.supports || []).length > 0 && (
                <span className="text-silver/70"> · 备选：{cast.supports.map((x) => x.occupation || '形象').join('、')}</span>
              )}
            </p>
          )}
          {actionMsg && <p className="text-xs text-gold/90 mb-2 leading-relaxed">{actionMsg}</p>}
          {task?.error && (
            <p className="text-xs text-red-400 mb-2 flex items-start gap-1.5 leading-relaxed">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              {task.error}
            </p>
          )}

          <div className="flex-1 overflow-y-auto space-y-2 -mx-1 px-1">
            {clips.length === 0 && !task && (
              <p className="text-xs text-silver/70 leading-relaxed">
                把这首诗的每幅画面（主视觉 + 各场景）各自配上一段诗句，
                用 AI 逐幅生成短视频。需要：图片公网可达（PUBLIC_ASSET_BASE）+ Ark API Key。
              </p>
            )}
            {clips.map((c) => {
              const label = CLIP_LABEL[c.id] || `场景 ${String(c.id).replace('scene-', '')}`;
              const src = c.localUrl || c.videoUrl;
              return (
                <div key={c.id} className="rounded-lg border border-darkline bg-ink/70 p-2.5">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs text-silver">{label}</span>
                    {c.status === 'done' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-gold"><CheckCircle2 size={11} />完成</span>
                    ) : c.status === 'failed' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-red-400"><AlertCircle size={11} />失败</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-silver/80">
                        <Loader2 size={10} className="animate-spin" />
                        {c.status === 'queued' ? '排队' : c.status === 'submitted' ? '已提交' : '生成中'}
                      </span>
                    )}
                  </div>
                  {c.error && <p className="text-[10px] text-red-400/90 break-all mb-1">{c.error}</p>}
                  {c.prompt && <p className="text-[11px] text-paper/60 poem-text mb-1.5 line-clamp-2">{c.prompt}</p>}
                  {c.status === 'done' && src && (
                    <div className="relative rounded-md overflow-hidden border border-darkline bg-black">
                      <video
                        src={src}
                        controls
                        preload="metadata"
                        playsInline
                        className="w-full block bg-black"
                      />
                      {/* 竖排诗句字幕：前端叠加，不进画面 */}
                      {c.prompt && (
                        <p
                          className="poem-text pointer-events-none absolute top-3 right-2.5 max-h-[92%] overflow-hidden font-serif text-[15px] leading-[1.9] tracking-wide text-paper"
                          style={{ writingMode: 'vertical-rl', textShadow: '0 1px 8px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.9)' }}
                          title={c.prompt}
                        >
                          {c.prompt}
                        </p>
                      )}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-9 bg-gradient-to-t from-black/70 to-transparent" />
                    </div>
                  )}
                </div>
              );
            })}
            {isBusy && clips.length === 0 && (
              <div className="flex items-center justify-center py-6 text-silver"><Loader2 className="animate-spin text-gold mr-2" size={16} />任务排队中…</div>
            )}
          </div>

          {clips.length === 0 && (
            <button
              onClick={start}
              disabled={starting || isBusy}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 bg-gold text-ink px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gold/90 disabled:opacity-60 transition-colors"
            >
              {starting ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
              {starting ? '提交中…' : '开始生成（为每幅画面生成一段视频）'}
            </button>
          )}
          {failClips.length > 0 && !isBusy && clips.some((c) => c.status === 'done') && (
            <button onClick={start} className="mt-2 w-full text-xs text-silver hover:text-gold">
              重试失败片段
            </button>
          )}
        </div>
      )}
    </>
  );
}