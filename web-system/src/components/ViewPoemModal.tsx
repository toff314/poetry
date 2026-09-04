import { useEffect, useState } from 'react';
import { X, Copy, Check, Loader2 } from 'lucide-react';
import { getPoemText } from '../lib/api';
import type { PoemPlain } from '../lib/api';

interface Props {
  /** 已持有原文数据时直接传入（Library 卡片），无需再请求 */
  poem?: PoemPlain | null;
  /** 仅传 id 时（Gallery 等）自动取全文：优先 generated 包，回退诗词库 */
  poemId?: string;
  onClose: () => void;
}

export default function ViewPoemModal({ poem, poemId, onClose }: Props) {
  const [data, setData] = useState<PoemPlain | null>(poem || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // 无本地数据（poem）时按 id 拉取
  useEffect(() => {
    if (poem) {
      setData(poem);
      return;
    }
    if (!poemId) return;
    let disposed = false;
    setLoading(true);
    setError('');
    getPoemText(poemId)
      .then((d) => {
        if (disposed) return;
        setData(d);
        if (!d) setError('未能取到这首诗的原文');
      })
      .catch(() => {
        if (!disposed) {
          setError('加载失败，请稍后重试');
        }
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [poem, poemId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!data && !loading) {
    return null;
  }

  const copyAll = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(`${data.title}\n${data.author}${data.dynasty ? `（${data.dynasty}）` : ''}\n\n${data.content}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // 忽略复制失败
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-ink-light border border-darkline rounded-2xl overflow-hidden shadow-2xl">
        {/* header */}
        <div className="shrink-0 flex items-start justify-between gap-4 px-7 pt-6 pb-4 border-b border-darkline/70">
          <div>
            {data?.dynasty && (
              <p className="text-[10px] tracking-[0.25em] text-gold uppercase mb-1.5">{data.dynasty}</p>
            )}
            <h2 className="font-serif text-2xl md:text-3xl text-paper">{data?.title || '原诗'}</h2>
            {data?.author && <p className="text-sm text-silver mt-1">{data.author}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={copyAll}
              className="inline-flex items-center gap-1.5 text-xs text-silver border border-darkline rounded-lg px-3 py-1.5 hover:text-gold hover:border-gold/50 transition-colors"
              title="复制全文"
            >
              {copied ? <Check size={13} className="text-gold" /> : <Copy size={13} />}
              {copied ? '已复制' : '复制全文'}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-silver hover:text-paper hover:bg-ink transition-colors"
              aria-label="关闭"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* body：原诗全文 */}
        <div className="flex-1 overflow-y-auto px-7 py-6 md:px-10">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-silver">
              <Loader2 className="animate-spin text-gold mr-2" size={18} />
              正在取回原文…
            </div>
          ) : error ? (
            <p className="text-center py-12 text-silver/80 text-sm">{error}</p>
          ) : (
            <p className="font-serif text-[19px] leading-[2.1] text-paper/95 poem-text whitespace-pre-wrap text-center">
              {data?.content}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
