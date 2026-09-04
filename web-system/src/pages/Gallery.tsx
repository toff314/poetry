import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Play, ArrowRight, Calendar, BookOpen } from 'lucide-react';
import { getGeneratedIndex } from '../lib/api';
import type { GeneratedSummary } from '../lib/api';
import ViewPoemModal from '../components/ViewPoemModal';

/** 无真实封面时的诗风渐变（与望岳等占位观感一致） */
const PALETTES: [string, string][] = [
  ['#0a0a0b', '#3d2818'],
  ['#0a0a0b', '#1a3a3a'],
  ['#0a0a0b', '#3a2438'],
  ['#0a0a0b', '#243a2a'],
];

function hashIdx(s: string, n: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % n;
}

/** 常见朝代展示顺序 */
const DYNASTY_ORDER = ['唐朝', '宋朝', '五代', '春秋战国', '三国', '清朝'];

export default function Gallery() {
  const [items, setItems] = useState<GeneratedSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [dyn, setDyn] = useState('');
  const [viewing, setViewing] = useState<GeneratedSummary | null>(null);

  useEffect(() => {
    getGeneratedIndex()
      .then((res) => setItems(res?.poems || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const dynasties = useMemo(() => {
    const set = new Set(items.map((g) => g.dynasty || '未标注'));
    const known = DYNASTY_ORDER.filter((d) => set.has(d));
    const rest = Array.from(set)
      .filter((d) => !DYNASTY_ORDER.includes(d))
      .sort();
    return [...known, ...rest];
  }, [items]);

  const shown = useMemo(
    () => (dyn ? items.filter((g) => (g.dynasty || '未标注') === dyn) : items),
    [items, dyn]
  );

  return (
    <div className="min-h-screen bg-ink pb-24">
      {/* Hero */}
      <section className="relative py-24 px-6 lg:px-10 border-b border-darkline bg-[radial-gradient(ellipse_at_top,rgba(139,90,43,0.16),transparent_60%)]">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs tracking-[0.3em] text-gold uppercase mb-4">AI Immersive Worlds</p>
          <h1 className="font-serif text-4xl md:text-5xl text-paper mb-6">沉浸画廊</h1>
          <p className="text-silver max-w-2xl leading-relaxed">
            这里收藏所有已完成 AI 电影化的诗作——画面、逐段解读、配乐与朗诵都已备好。
            点开一幅，走入这首诗。还没有你喜欢的？去诗词库现做一部。
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              to="/library"
              className="inline-flex items-center gap-2 bg-gold text-ink px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gold/90 transition-colors"
            >
              <Sparkles size={16} />
              去诗词库制作新沉浸页
            </Link>
            <span className="text-xs text-silver/70">
              已收录 {items.length} 部{items.filter((g) => g.hasArt).length > 0 ? ` · 含实景封面 ${items.filter((g) => g.hasArt).length} 部` : ''}
            </span>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10">
        {/* 朝代筛选 */}
        {dynasties.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-10">
            <button
              onClick={() => setDyn('')}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                dyn === '' ? 'bg-gold text-ink border-gold' : 'border-darkline text-silver hover:border-silver'
              }`}
            >
              全部
            </button>
            {dynasties.map((d) => (
              <button
                key={d}
                onClick={() => setDyn(d === dyn ? '' : d)}
                className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                  dyn === d ? 'bg-gold/15 text-gold border-gold/60' : 'border-darkline text-silver hover:border-silver'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="aspect-[16/10] bg-ink-light border border-darkline rounded-xl animate-pulse" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-darkline rounded-xl">
            <p className="text-silver mb-2">{dyn ? `「${dyn}」还没有已生成的沉浸页` : '还没有已生成的沉浸页'}</p>
            <p className="text-xs text-silver/50 mb-6">选一首心仪的诗，用 AI 为它制作画面与朗诵</p>
            <Link
              to="/library"
              className="inline-flex items-center gap-2 bg-gold/15 text-gold border border-gold/40 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gold/25 transition-colors"
            >
              <Sparkles size={16} />
              前往诗词库
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shown.map((g) => {
              const withArt = g.hasArt && g.cover;
              const [c1, c2] = PALETTES[hashIdx(g.id, PALETTES.length)];
              return (
                <div
                  key={g.id}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-darkline hover:border-gold/40 transition-all bg-ink-light"
                >
                  <Link
                    to={`/poem/${g.id}`}
                    aria-label={`进入《${g.title}》沉浸阅读`}
                    className="block relative aspect-[16/10] overflow-hidden"
                  >
                    {withArt ? (
                      <img
                        src={g.cover}
                        alt={g.title}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div
                        className="w-full h-full"
                        style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
                      >
                        <div className="w-full h-full flex flex-col items-center justify-center gap-3 opacity-90">
                          <p className="font-serif text-3xl text-paper/90 tracking-[0.3em] poem-text">{g.title}</p>
                          {g.line && (
                            <p className="font-serif text-sm text-paper/70 px-6 text-center poem-text line-clamp-2">{g.line}</p>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                    {/* 朝代角标 */}
                    {g.dynasty && (
                      <span className="absolute top-3 left-4 inline-flex items-center gap-1 text-[10px] tracking-wider text-paper/90 bg-black/45 border border-white/15 px-2 py-1 rounded backdrop-blur-sm">
                        <Calendar size={10} />
                        {g.dynasty}
                      </span>
                    )}
                    {/* 封面态遮罩提示 */}
                    {!withArt && (
                      <span className="absolute top-3 right-4 text-[10px] tracking-wider text-paper/80 bg-black/45 border border-white/15 px-2 py-1 rounded backdrop-blur-sm">
                        静待补图 · 可阅读
                      </span>
                    )}
                    <div className="absolute bottom-0 inset-x-0 p-4 flex items-end justify-between gap-2">
                      <div>
                        <p className="font-serif text-xl text-paper">{g.title}</p>
                        <p className="text-xs text-paper/70 mt-1">{g.author}</p>
                      </div>
                      <span className="shrink-0 inline-flex items-center gap-1 text-xs text-gold opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play size={13} />
                        进入沉浸阅读
                      </span>
                    </div>
                  </Link>
                  {/* 底部操作条 */}
                  <div className="flex items-center justify-between px-4 py-2.5 border-t border-darkline/60">
                    <button
                      onClick={() => setViewing(g)}
                      className="inline-flex items-center gap-1.5 text-xs text-silver hover:text-paper transition-colors"
                    >
                      <BookOpen size={13} />
                      查看原诗
                    </button>
                    <Link
                      to={`/poem/${g.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-gold hover:underline"
                    >
                      <Play size={13} />
                      进入沉浸阅读
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {shown.length > 0 && (
          <div className="mt-14 text-center">
            <Link
              to="/library"
              className="inline-flex items-center gap-2 text-sm text-silver hover:text-gold transition-colors"
            >
              还没有喜欢的？去诗词库现做一部
              <ArrowRight size={15} />
            </Link>
          </div>
        )}
      </div>
      {viewing && <ViewPoemModal poemId={viewing.id} onClose={() => setViewing(null)} />}
    </div>
  );
}