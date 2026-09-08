import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Sparkles, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import TagPill from './TagPill';

export interface GenPoemLike {
  id: string;
  title: string;
  author?: string;
  dynasty?: string;
  content?: string;
}

/** 生成沉浸页弹框：在来源页原地生成，不跳转、不刷新；成功后可进入沉浸页 */
export default function GenerateModal({ poem, onClose }: { poem: GenPoemLike; onClose: () => void }) {
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<{ pct: number; detail: string } | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const start = async () => {
    if (generating) return;
    setGenerating(true);
    setError('');
    setProgress({ pct: 0, detail: '排队中…' });
    try {
      const res = await fetch('/api/generate-ai/' + encodeURIComponent(poem.id), {
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
      const taskId = t.taskId || poem.id;
      for (let i = 0; i < 360; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const sr = await fetch('/api/generate-ai/' + encodeURIComponent(taskId));
        if (!sr.ok) continue;
        const st = await sr.json();
        setProgress({ pct: st.progress || 0, detail: st.detail || st.stage || '生成中…' });
        if (st.status === 'done') {
          setDone(true);
          setGenerating(false);
          return;
        }
        if (st.status === 'error') throw new Error(st.error || '生成失败，请重试');
      }
      throw new Error('生成超时，可稍后重试');
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败，请重试');
      setGenerating(false);
      setProgress(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="AI 生成沉浸页"
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-gold/25 bg-ink-light/97 shadow-2xl flex flex-col max-h-[86vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-darkline/70">
          <div className="min-w-0">
            <p className="text-[10px] tracking-[0.3em] text-gold uppercase mb-2">AI Immersive · 制作沉浸页</p>
            <h3 className="font-serif text-2xl md:text-3xl text-paper leading-snug truncate">{poem.title}</h3>
            <p className="text-sm text-silver mt-1">
              {poem.author || ''}{poem.dynasty ? ` · ${poem.dynasty}` : ''}
            </p>
            <div className="mt-1.5">
              <TagPill dbId={poem.id} author={poem.author} title={poem.title} />
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 p-1.5 text-silver hover:text-paper rounded-full" aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        {/* 原文 */}
        <div className="px-6 py-5 border-b border-darkline/50">
          <p className="text-[10px] tracking-widest text-silver/60 uppercase mb-2">原诗</p>
          {poem.content ? (
            <div className="max-h-[30vh] overflow-y-auto pr-2 font-serif text-base md:text-lg text-paper/90 leading-loose poem-text whitespace-pre-wrap">
              {poem.content}
            </div>
          ) : (
            <p className="text-silver text-sm">原诗取回中…</p>
          )}
        </div>

        {/* 操作区 */}
        <div className="px-6 py-5">
          {done ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-gold flex items-center gap-2">
                <CheckCircle2 size={16} />
                沉浸页已生成！
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => navigate(`/poem/${encodeURIComponent(poem.id)}`)}
                  className="inline-flex items-center gap-2 bg-gold text-ink px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gold/90"
                >
                  进入沉浸阅读 <ArrowRight size={15} />
                </button>
                <button onClick={onClose} className="px-4 py-2.5 text-sm text-silver border border-darkline rounded-lg hover:border-silver">
                  关闭
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-silver/70 leading-relaxed">
                为这首诗生成电影感画面、逐段直译与解读（约每幅 1 分钟），完成后可在弹框内直接进入。
              </p>
              {generating && progress ? (
                <div>
                  <div className="h-1.5 w-full bg-ink rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-gold transition-all duration-700" style={{ width: `${Math.max(3, progress.pct)}%` }} />
                  </div>
                  <p className="text-xs text-gold/90">{progress.detail} {progress.pct}%</p>
                </div>
              ) : (
                <button
                  onClick={start}
                  disabled={generating}
                  className="inline-flex items-center justify-center gap-2 bg-gold text-ink px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gold/90 disabled:opacity-60"
                >
                  {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  用 AI 生成沉浸页（图 + 朗诵）
                </button>
              )}
              {error && <p className="text-sm text-red-400 leading-relaxed">{error}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}