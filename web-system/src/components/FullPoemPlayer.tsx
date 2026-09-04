import { useEffect, useState } from 'react';
import { Film, Play, X } from 'lucide-react';

/**
 * 全诗放映（网站管理员预生成整片入口）：
 *   - 若该诗已生成整片（public/videos/<poemId>/full.mp4），首屏提供「全诗放映」按钮，
 *     点击全屏浮层顺序播放整片（整片由 scripts/concat-video.mjs 拼接 scene-N 视频）。
 *   - 若尚未生成，仅展示静态提示「请联系网站管理员」——不再向访客开放自助生成。
 */
const fullVideoUrl = (poemId: string) => `/videos/${poemId}/full.mp4`;

export default function FullPoemPlayer({ poemId, title }: { poemId: string; title?: string }) {
  const [state, setState] = useState<'pending' | 'has' | 'none'>('pending');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!poemId) {
      setState('none');
      return;
    }
    let alive = true;
    // HEAD 探测：public 静态命中返回 video/mp4；不存在则落入 SPA fallback（text/html）
    fetch(fullVideoUrl(poemId), { method: 'HEAD' })
      .then((r) => {
        const ct = r.headers.get('content-type') || '';
        if (alive) setState(ct.startsWith('video/') ? 'has' : 'none');
      })
      .catch(() => {
        if (alive) setState('none');
      });
    return () => {
      alive = false;
    };
  }, [poemId]);

  if (!poemId || state === 'pending') return null;

  if (state === 'none') {
    return (
      <p
        className="mt-10 inline-flex items-center gap-2 rounded-full border border-white/10 bg-ink-light/60 backdrop-blur-md px-4 py-2 text-xs text-silver/75"
        title="视频由网站管理员预生成"
      >
        <Film size={13} />
        本诗视频制作中 · 请联系网站管理员
      </p>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-10 inline-flex items-center gap-2.5 rounded-full bg-gold/90 hover:bg-gold text-ink px-5 py-2.5 text-sm font-medium transition-colors"
        title="顺序播放本诗全部场景 AI 视频（整片）"
      >
        <Film size={15} />
        全诗放映
        <span className="inline-flex items-center gap-1 text-[10px] text-ink/70 font-normal">
          <Play size={9} /> 整片
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] bg-black/92 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`${title || '全诗'}放映`}
        >
          <div
            className="relative w-full max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="font-serif text-lg text-paper/90">
                {title ? `${title} · ` : ''}全诗放映
              </p>
              <button
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1.5 text-xs text-silver hover:text-paper rounded-full border border-white/15 px-3 py-1.5 transition-colors"
                aria-label="关闭"
              >
                <X size={13} /> 关闭
              </button>
            </div>
            <video
              key={fullVideoUrl(poemId)}
              src={fullVideoUrl(poemId)}
              controls
              autoPlay
              playsInline
              className="w-full aspect-video rounded-xl bg-black shadow-2xl border border-white/10"
            />
          </div>
        </div>
      )}
    </>
  );
}
