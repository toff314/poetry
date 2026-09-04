import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, User, Calendar, Sparkles, X, Play, BookOpen } from 'lucide-react';
import { getPoets, getLibrary, getGeneratedIndex } from '../lib/api';
import type { Poem, Poet } from '../types';
import ViewPoemModal from '../components/ViewPoemModal';

const PAGE_SIZE = 24;

/** 主内容区标题：朝代/诗人/关键词 组合描述 */
function describeFilter(dynasty: string, poet: string, q: string): string {
  if (q.trim()) {
    const scope = [dynasty, poet].filter(Boolean).join(' · ');
    return scope ? `搜索 "${q}" · ${scope}` : `搜索 "${q}" 的结果`;
  }
  if (poet) return dynasty ? `${dynasty} · ${poet} 的诗作` : `${poet} 的诗作`;
  if (dynasty) return `${dynasty} 的诗作`;
  return '';
}

export default function Library() {
  const [searchParams] = useSearchParams();
  const [poets, setPoets] = useState<Poet[]>([]);
  const [generatedIds, setGeneratedIds] = useState<Set<string>>(new Set());
  const [selectedDynasty, setSelectedDynasty] = useState<string>('');
  const [selectedPoet, setSelectedPoet] = useState<string>('');
  const [poems, setPoems] = useState<Poem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewPoem, setViewPoem] = useState<Poem | null>(null);

  useEffect(() => {
    getPoets().then((res) => {
      const list = res?.data?.poets || [];
      setPoets(list.filter((p) => p.count > 0));
    });
    // 已生成 AI 沉浸页的作品 id 集合（卡片标记用）
    getGeneratedIndex()
      .then((res) => setGeneratedIds(new Set((res?.poems || []).map((g) => g.id))))
      .catch(() => setGeneratedIds(new Set()));
  }, []);

  // 支持 /library?poet=李白 直达预选（首页诗人走廊等入口）
  useEffect(() => {
    const poetParam = searchParams.get('poet') || '';
    if (poetParam) {
      setSelectedPoet(poetParam);
      setQuery('');
    }
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
  }, [selectedDynasty, selectedPoet, query]);

  // 组合筛选：朝代 × 诗人 × 关键词，任意叠加
  const hasFilter = Boolean(selectedDynasty || selectedPoet || query.trim());
  useEffect(() => {
    setLoading(true);
    if (!hasFilter) {
      setPoems([]);
      setTotalPages(1);
      setLoading(false);
      return;
    }
    getLibrary({
      dynasty: selectedDynasty || undefined,
      poet: selectedPoet || undefined,
      q: query.trim() || undefined,
      page,
      limit: PAGE_SIZE,
    })
      .then((res) => {
        setPoems(res?.data?.poems || []);
        setTotalPages(res?.data?.total_pages || 1);
      })
      .finally(() => setLoading(false));
  }, [selectedDynasty, selectedPoet, query, page, hasFilter]);

  const dynasties = useMemo(() => {
    const set = new Set<string>();
    poets.forEach((p) => {
      const d = p.dynasty || '其他';
      set.add(d);
    });
    return Array.from(set);
  }, [poets]);

  const filteredPoets = useMemo(() => {
    return selectedDynasty ? poets.filter((p) => (p.dynasty || '其他') === selectedDynasty) : poets;
  }, [poets, selectedDynasty]);

  // 点击朝代：切换选中；作为新筛选起点，清空诗人与关键词
  const handleDynastyClick = (d: string) => {
    if (selectedDynasty === d) {
      setSelectedDynasty('');
      return;
    }
    setSelectedDynasty(d);
    setSelectedPoet('');
    setQuery('');
  };

  const clearAll = () => {
    setSelectedDynasty('');
    setSelectedPoet('');
    setQuery('');
  };

  return (
    <div className="min-h-screen bg-ink pb-20">
      {/* Hero */}
      <section className="relative py-24 px-6 lg:px-10 border-b border-darkline">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs tracking-[0.3em] text-gold uppercase mb-4">Library</p>
          <h1 className="font-serif text-4xl md:text-5xl text-paper mb-6">诗词库</h1>
          <p className="text-silver max-w-xl">从数千首古典诗词中搜索，选择一首生成沉浸式电影页面。</p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar filters */}
          <aside className="lg:w-64 shrink-0">
            <div className="sticky top-24 space-y-8">
              {/* Search */}
              <div>
                <label className="text-xs tracking-widest text-silver uppercase mb-3 block">搜索</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-silver" size={16} />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="诗词、诗人..."
                    className="w-full bg-ink-light border border-darkline rounded-lg pl-10 pr-4 py-2.5 text-sm text-paper placeholder-silver focus:border-gold focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Dynasty filter */}
              <div>
                <label className="text-xs tracking-widest text-silver uppercase mb-3 block">朝代</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleDynastyClick('')}
                    className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                      selectedDynasty === '' ? 'bg-gold text-ink border-gold' : 'border-darkline text-silver hover:border-silver'
                    }`}
                  >
                    全部
                  </button>
                  {dynasties.map((d) => (
                    <button
                      key={d}
                      onClick={() => handleDynastyClick(d)}
                      className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                        selectedDynasty === d
                          ? 'bg-gold/15 text-gold border-gold/60'
                          : 'border-darkline text-silver hover:border-silver'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Poet list */}
              <div>
                <label className="text-xs tracking-widest text-silver uppercase mb-3 block">
                  诗人{selectedDynasty ? ` · ${selectedDynasty}` : ''}
                </label>
                <div className="max-h-[400px] overflow-y-auto pr-2 space-y-1">
                  {filteredPoets.slice(0, 50).map((poet) => (
                    <button
                      key={poet.name}
                      onClick={() => {
                        setSelectedPoet(poet.name === selectedPoet ? '' : poet.name);
                        setQuery('');
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                        selectedPoet === poet.name
                          ? 'bg-gold/10 text-gold border border-gold/30'
                          : 'text-silver hover:bg-ink-light'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <User size={14} />
                        {poet.name}
                      </span>
                      <span className="text-xs text-silver/60">{poet.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1">
            {!hasFilter ? (
              <div className="text-center py-24 border border-dashed border-darkline rounded-xl">
                <p className="text-silver mb-2">请选择朝代、诗人或输入关键词开始浏览</p>
                <p className="text-xs text-silver/50">诗词库由 poetry-cli 完整驱动</p>
              </div>
            ) : loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-40 bg-ink-light border border-darkline rounded-xl animate-pulse" />
                ))}
              </div>
            ) : poems.length === 0 ? (
              <div className="text-center py-24 border border-dashed border-darkline rounded-xl">
                <p className="text-silver">未找到相关诗词</p>
                <button onClick={clearAll} className="mt-4 text-xs text-gold hover:underline">
                  清空筛选条件
                </button>
              </div>
            ) : (
              <>
                <div className="mb-6 flex items-center justify-between">
                  <p className="text-sm text-silver">{describeFilter(selectedDynasty, selectedPoet, query)}</p>
                  {hasFilter && (
                    <button onClick={clearAll} className="inline-flex items-center gap-1 text-xs text-gold hover:underline">
                      <X size={12} />
                      清空筛选
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {poems.map((poem) => (
                    <div
                      key={poem.id}
                      className="group p-6 bg-ink-light border border-darkline rounded-xl hover:border-gold/40 transition-all flex flex-col"
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <h3 className="font-serif text-xl text-paper group-hover:text-gold transition-colors line-clamp-1">
                          {poem.title}
                        </h3>
                        <span className="shrink-0 flex items-center gap-1.5">
                          {poem.dynasty && (
                            <span className="inline-flex items-center gap-1 text-[10px] tracking-wider text-silver border border-darkline px-2 py-1 rounded">
                              <Calendar size={10} />
                              {poem.dynasty}
                            </span>
                          )}
                          {generatedIds.has(poem.id) && (
                            <span className="inline-flex items-center gap-1 text-[10px] tracking-wider text-gold border border-gold/50 bg-gold/10 px-2 py-1 rounded font-medium">
                              <Sparkles size={10} />
                              沉浸版
                            </span>
                          )}
                        </span>
                      </div>
                      <p className="text-sm text-silver mb-4">{poem.author}</p>
                      <p className="font-serif text-sm text-paper/70 line-clamp-3 poem-text mb-6 flex-1">
                        {poem.content.slice(0, 80)}...
                      </p>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => setViewPoem(poem)}
                          className="inline-flex items-center gap-1.5 text-xs text-silver hover:text-gold transition-colors"
                          title="只看原诗全文，不生成"
                        >
                          <BookOpen size={14} />
                          查看原诗
                        </button>
                        <Link
                          to={`/poem/${poem.id}`}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-gold hover:underline"
                        >
                          {generatedIds.has(poem.id) ? (
                            <>
                              <Play size={14} />
                              进入沉浸页
                            </>
                          ) : (
                            <>
                              <Sparkles size={14} />
                              生成沉浸页
                            </>
                          )}
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-10 flex items-center justify-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="px-4 py-2 text-sm rounded-lg border border-darkline text-silver hover:border-silver disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      上一页
                    </button>
                    <span className="text-sm text-silver px-4">{page} / {totalPages}</span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="px-4 py-2 text-sm rounded-lg border border-darkline text-silver hover:border-silver disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      下一页
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {viewPoem && <ViewPoemModal poem={viewPoem} onClose={() => setViewPoem(null)} />}
    </div>
  );
}