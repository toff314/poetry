import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, Sparkles, BookOpen, Shuffle, ArrowRight, Play, RefreshCw, Dices, LibraryBig } from 'lucide-react';
import { getRandomPoem, getGeneratedIndex, getPoets, getPoetAvatars } from '../lib/api';
import type { PoetAvatarBrief } from '../lib/api';
import type { GeneratedSummary } from '../lib/api';
import type { Poem, Poet } from '../types';

// 诗性渐变兜底（站内无 AI 封面时的 Hero / 卡片背景，延续水墨暗色体系）
const GRADIENTS = [
  'linear-gradient(135deg, #0a0a0b 0%, #1a1410 30%, #3d2818 65%, #5c3a1e 100%)',
  'linear-gradient(135deg, #0d0d12 0%, #1f1f2e 30%, #3a3a4a 65%, #5a5a6a 100%)',
  'linear-gradient(135deg, #1a2216 0%, #2e3a24 40%, #4a5a36 75%, #6a7a4e 100%)',
];

function firstLine(content: string): string {
  return (content || '').split(/[。，；？！\n]/).find(Boolean) || '';
}

function displayTitle(p: { title?: string; content?: string }): string {
  if (p.title && p.title.trim()) return p.title.trim();
  return '无题';
}

function PoetryCard({ poem }: { poem: Poem }) {
  const line = firstLine(poem.content);
  return (
    <div className="p-6 bg-ink-light/80 backdrop-blur-md border border-darkline rounded-xl hover:border-gold/40 transition-colors">
      <p className="text-xs tracking-widest text-gold mb-3">今日一诗</p>
      <h3 className="font-serif text-2xl text-paper mb-2">{displayTitle(poem)}</h3>
      <p className="text-sm text-silver mb-4">{poem.author} · {poem.dynasty || '古诗'}</p>
      {line && <p className="font-serif text-base text-paper/80 line-clamp-2 poem-text">{line}</p>}
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [generated, setGenerated] = useState<GeneratedSummary[]>([]);
  const [poets, setPoets] = useState<Poet[]>([]);
  const [avatarList, setAvatarList] = useState<PoetAvatarBrief[]>([]);
  const [bgIndex, setBgIndex] = useState(0);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState('');

  // 命运卡（今日一诗区块的交互对象）
  const [fate, setFate] = useState<Poem | null>(null);
  const [fateLoading, setFateLoading] = useState(false);

  const artPages = useMemo(() => generated.filter((g) => g.hasArt && g.cover), [generated]);
  const heroBgPool = useMemo(() => artPages.map((g) => g.cover as string), [artPages]);
  const featured = artPages;

  async function drawRandomPoem() {
    const res = await getRandomPoem();
    const poem = res?.data?.poem;
    if (!poem) throw new Error('empty response');
    return poem;
  }

  // 随机开卷：随机一首 → 已生成直接进入沉浸页；未生成进入生成引导
  const handleRandomOpen = async () => {
    if (opening) return;
    setOpening(true);
    setOpenError('');
    try {
      const poem = await drawRandomPoem();
      navigate(`/poem/${poem.id}`);
    } catch (e) {
      setOpenError('随机取诗失败，请稍后再试');
      setOpening(false);
    }
  };

  const drawFate = async () => {
    setFateLoading(true);
    try {
      const poem = await drawRandomPoem();
      setFate(poem);
    } catch {
      setFate(null);
    } finally {
      setFateLoading(false);
    }
  };

  useEffect(() => {
    getGeneratedIndex()
      .then((res) => setGenerated(res?.poems || []))
      .catch(() => setGenerated([]));
    getPoetAvatars()
      .then((res) => setAvatarList(res?.data?.poets || []))
      .catch(() => {});
    getPoets()
      .then((res) => {
        const list = res?.data?.poets || [];
        setPoets(list.filter((p) => p.count > 0));
      })
      .catch(() => setPoets([]));
    drawFate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 有真实封面时轮播 Hero 背景
  useEffect(() => {
    if (heroBgPool.length <= 1) return;
    const t = setInterval(() => setBgIndex((i) => (i + 1) % heroBgPool.length), 8000);
    return () => clearInterval(t);
  }, [heroBgPool.length]);

  const heroHint = featured[0] || null;
  const fateLine = fate ? firstLine(fate.content) : '';

  return (
    <div>
      {/* ============ ① Hero · 电影开场 ============ */}
      <section className="relative h-screen min-h-[680px] flex items-center overflow-hidden">
        {/* 背景：站内 AI 封面轮播；无封面时诗性渐变 */}
        {heroBgPool.length > 0
          ? heroBgPool.map((src, i) => (
              <div
                key={src}
                className={`absolute inset-0 transition-opacity duration-1000 ${i === bgIndex ? 'opacity-100' : 'opacity-0'}`}
              >
                <img src={src} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 image-overlay" />
              </div>
            ))
          : (
            <div className="absolute inset-0" style={{ background: GRADIENTS[bgIndex % GRADIENTS.length] }}>
              <div className="absolute inset-0 image-overlay" />
            </div>
          )}

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-xs font-medium tracking-[0.3em] text-gold uppercase mb-6">
              AI Immersive Poetry · 沉浸式诗词电影
            </p>
            <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-medium text-paper leading-[1.1] mb-8">
              诗境
            </h1>
            <p className="text-lg md:text-xl text-silver leading-relaxed mb-10 max-w-xl">
              把一首中国古典诗词，变成一部可以滑进去的电影——
              <br className="hidden md:block" />
              AI 生成画面、逐段解读、随卷轴展开的阅读。
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={handleRandomOpen}
                disabled={opening}
                className="inline-flex items-center gap-2 bg-gold text-ink px-7 py-3.5 rounded-lg text-base font-medium hover:bg-gold/90 transition-colors disabled:opacity-60 disabled:cursor-wait"
              >
                {opening ? <RefreshCw size={18} className="animate-spin" /> : <Dices size={18} />}
                {opening ? '正在开卷…' : '随机开卷'}
              </button>
              <Link
                to="/library"
                className="inline-flex items-center gap-2 border border-paper/30 text-paper px-7 py-3.5 rounded-lg text-base font-medium hover:bg-paper/10 transition-colors"
              >
                <LibraryBig size={18} />
                浏览诗词库
              </Link>
            </div>
            {openError && <p className="mt-4 text-sm text-red-400">{openError}</p>}
            <p className="mt-6 text-xs text-silver/60 max-w-md leading-relaxed">
              随机开卷：随机取一首诗词 —— 已制成电影页直接开读，未生成的可现场用 AI 制作。
            </p>
          </div>
        </div>

        {/* Hero 右下：正在放映 / 今日一诗 */}
        <div className="absolute bottom-24 right-6 lg:right-10 z-10 hidden lg:block w-80 animate-slide-up">
          {heroHint ? (
            <Link
              to={`/poem/${heroHint.id}`}
              className="group block overflow-hidden rounded-xl border border-white/10 hover:border-gold/40 transition-colors"
            >
              <div className="relative aspect-video overflow-hidden">
                <img src={heroHint.cover} alt={heroHint.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <p className="absolute top-3 left-4 text-[10px] tracking-[0.25em] text-gold uppercase">正在放映</p>
                <div className="absolute bottom-0 inset-x-0 p-4">
                  <p className="font-serif text-xl text-paper">{heroHint.title}</p>
                  <p className="text-xs text-paper/70 mt-1 flex items-center gap-1">
                    <Play size={12} /> 进入沉浸阅读
                  </p>
                </div>
              </div>
            </Link>
          ) : fate ? (
            <Link to={`/poem/${fate.id}`} className="block hover:border-gold/40">
              <PoetryCard poem={fate} />
            </Link>
          ) : (
            <div className="p-6 bg-ink-light/80 backdrop-blur-md border border-darkline rounded-xl">
              <p className="text-silver">正在开卷...</p>
            </div>
          )}
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 text-silver animate-bounce">
          <ChevronDown size={24} />
        </div>
      </section>

      {/* ============ ② AI 沉浸世界 · 精选画廊 ============ */}
      <section className="py-24 px-6 lg:px-10 bg-ink">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="text-xs tracking-[0.3em] text-gold uppercase mb-3">AI Immersive Worlds</p>
              <h2 className="font-serif text-3xl md:text-4xl text-paper">AI 沉浸世界</h2>
              <p className="text-silver mt-3 max-w-xl">用 AI 生成的电影感画面，把诗变成可以走入的世界。点开一幅，开始阅读。</p>
            </div>
            <Link to="/gallery" className="hidden md:flex items-center gap-2 text-sm text-silver hover:text-gold transition-colors">
              全部沉浸作品
              <ArrowRight size={15} />
            </Link>
          </div>

          {featured.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:grid-cols-3">
              {featured.map((g) => (
                <Link
                  key={g.id}
                  to={`/poem/${g.id}`}
                  className="group relative overflow-hidden rounded-xl border border-darkline hover:border-gold/40 transition-all"
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-ink-light">
                    <img
                      src={g.cover}
                      alt={g.title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-90" />
                    {g.line && (
                      <p className="absolute top-4 left-5 right-5 font-serif text-sm text-gold/95 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 line-clamp-2">
                        {g.line}
                      </p>
                    )}
                    <div className="absolute bottom-0 inset-x-0 p-5">
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <h3 className="font-serif text-2xl text-paper group-hover:text-gold transition-colors">{g.title}</h3>
                          <p className="text-sm text-paper/70 mt-1">{g.author}</p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 text-xs text-gold border border-gold/40 rounded-full px-3 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play size={12} /> 进入
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}

              {/* 引导卡：不足一屏时提示把下一首也做成电影 */}
              <button
                onClick={handleRandomOpen}
                disabled={opening}
                className="group relative aspect-[16/10] rounded-xl border border-dashed border-darkline hover:border-gold/50 transition-colors flex flex-col items-center justify-center gap-3 p-6 text-center bg-ink-light/40 hover:bg-ink-light/80"
              >
                <span className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-gold/40 text-gold group-hover:bg-gold group-hover:text-ink transition-colors">
                  {opening ? <RefreshCw size={20} className="animate-spin" /> : <Sparkles size={20} />}
                </span>
                <span className="font-serif text-lg text-paper">把下一首也做成电影</span>
                <span className="text-xs text-silver/70 max-w-[200px]">随机取一首诗，用 AI 为它生成画面与解读</span>
              </button>
            </div>
          ) : (
            <div className="p-12 border border-dashed border-darkline rounded-xl text-center">
              <p className="text-silver mb-6">还没有 AI 沉浸式页面 —— 从这里生成第一页</p>
              <button
                onClick={handleRandomOpen}
                disabled={opening}
                className="inline-flex items-center gap-2 bg-gold text-ink px-6 py-3 rounded-lg text-sm font-medium hover:bg-gold/90 transition-colors disabled:opacity-60"
              >
                {opening ? <RefreshCw size={16} className="animate-spin" /> : <Dices size={16} />}
                随机开卷，生成第一页
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ============ ③ 今日一诗 · 命运卡 ============ */}
      <section className="py-24 px-6 lg:px-10 border-y border-darkline/60 bg-ink/80">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <p className="text-xs tracking-[0.3em] text-gold uppercase mb-3">How It Works</p>
            <h2 className="font-serif text-3xl md:text-4xl text-paper mb-6 leading-snug">每一首诗，<br className="hidden md:block" />都值得一部电影</h2>
            <div className="space-y-5 mt-8">
              {[
                { n: '01', t: '翻出今日一首', d: '从 800 余首经典诗词中随机抽一张「命运卡」' },
                { n: '02', t: 'AI 制作电影页', d: '生成画面、逐段直译与细读，像分镜一样展开' },
                { n: '03', t: '沉浸阅读', d: '滚动即入画：背景随诗境切换，可读、可赏、可朗读' },
              ].map((s) => (
                <div key={s.n} className="flex gap-4 items-start">
                  <span className="font-mono text-gold/80 text-sm mt-0.5 shrink-0">{s.n}</span>
                  <div>
                    <p className="text-paper font-medium">{s.t}</p>
                    <p className="text-silver text-sm mt-1 leading-relaxed">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link to="/library" className="inline-flex items-center gap-2 mt-10 text-sm text-gold hover:underline">
              <BookOpen size={16} />
              去诗词库自己挑一首
            </Link>
          </div>

          {/* 命运卡 */}
          <div className="relative">
            <div className="absolute -inset-3 rounded-3xl opacity-60 pointer-events-none" style={{ background: 'radial-gradient(60% 60% at 70% 30%, rgba(200,160,90,0.12), transparent)' }} />
            <div className="relative rounded-2xl border border-gold/20 bg-ink-light/80 backdrop-blur-md overflow-hidden">
              {fateLoading || !fate ? (
                <div className="aspect-[4/3] flex flex-col items-center justify-center gap-4 p-10 text-center">
                  <div className="w-10 h-10 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
                  <p className="text-silver text-sm">正在翻开命运卡…</p>
                </div>
              ) : (
                <div key={fate.id} className="animate-fade-in">
                  <div className="px-8 pt-8 pb-6 border-b border-white/5">
                    <p className="text-[10px] tracking-[0.3em] text-gold uppercase mb-4">Fate Card · 命运卡</p>
                    <h3 className="font-serif text-3xl text-paper leading-snug">{displayTitle(fate)}</h3>
                    <p className="text-sm text-silver mt-2">{fate.author} {fate.dynasty ? `· ${fate.dynasty}` : ''}</p>
                  </div>
                  <div className="px-8 py-7 min-h-[150px] flex flex-col justify-center">
                    {fateLine ? (
                      <p className="font-serif text-xl md:text-2xl text-gold/95 leading-relaxed poem-text">{fateLine}</p>
                    ) : (
                      <p className="text-silver text-sm leading-relaxed line-clamp-4 poem-text">{fate.content}</p>
                    )}
                    <p className="mt-4 text-xs text-silver/60">滚动阅读全诗 · 或换一张卡</p>
                  </div>
                  <div className="px-8 pb-8 flex flex-wrap gap-3">
                    <button
                      onClick={() => navigate(`/poem/${fate.id}`)}
                      className="inline-flex items-center gap-2 bg-gold text-ink px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gold/90 transition-colors"
                    >
                      <Sparkles size={15} />
                      打开 / 生成这页
                    </button>
                    <button
                      onClick={drawFate}
                      className="inline-flex items-center gap-2 border border-darkline text-silver px-5 py-2.5 rounded-lg text-sm hover:border-silver transition-colors"
                    >
                      <Shuffle size={15} />
                      换一首
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============ ④ 走进诗人 ============ */}
      {poets.length > 0 && (
        <section className="py-24 px-6 lg:px-10 bg-ink">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="text-xs tracking-[0.3em] text-gold uppercase mb-3">Poets · 虚拟形象演绎</p>
                <h2 className="font-serif text-3xl md:text-4xl text-paper">走进诗人</h2>
                <p className="text-silver/80 text-sm mt-2">每位重要诗人均有专属虚拟形象出演，一首诗始终同一位形象。</p>
              </div>
              <Link to="/library" className="hidden md:flex items-center gap-2 text-sm text-silver hover:text-gold transition-colors">
                查看全部
                <ArrowRight size={15} />
              </Link>
            </div>

            {/* 第一排：重要诗人（专属形象图卡） */}
            {avatarList.length > 0 && (
              <div className="flex gap-5 overflow-x-auto pb-4 snap-x -mx-1 px-1 [scrollbar-width:thin] mb-2">
                {avatarList.map((p) => (
                  <Link
                    key={p.name}
                    to={`/library?poet=${encodeURIComponent(p.name)}`}
                    className="snap-start shrink-0 w-36 group"
                  >
                    <div className="relative aspect-[4/5] rounded-xl overflow-hidden border border-darkline bg-ink-light/60 group-hover:border-gold/50 transition-all">
                      {p.main?.img ? (
                        <img src={p.main.img} alt={p.name} loading="lazy"
                             className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#2a2218] to-[#3d2c18]">
                          <span className="font-serif text-4xl text-gold/90">{p.name.charAt(0)}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 px-0.5">
                      <p className="font-serif text-lg text-paper group-hover:text-gold transition-colors truncate">{p.name}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* 第二排：其他诗人（字卡） */}
            <div className="flex gap-4 overflow-x-auto pb-2 snap-x -mx-1 px-1 [scrollbar-width:thin] mt-4">
              {poets
                .filter((poet) => !avatarList.some((p) => p.name === poet.name))
                .filter((poet) => !['无名氏', '佚名', '不详'].includes(poet.name))
                .slice(0, 20)
                .map((poet) => (
                  <Link
                    key={poet.name}
                    to={`/library?poet=${encodeURIComponent(poet.name)}`}
                    className="snap-start shrink-0 w-36 group p-4 rounded-xl border border-darkline bg-ink-light/50 hover:border-gold/40 transition-all"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#2a2218] to-[#3d2c18] border border-gold/15 flex items-center justify-center mb-3">
                      <span className="font-serif text-xl text-gold/80">{poet.name.charAt(0)}</span>
                    </div>
                    <p className="font-serif text-base text-paper group-hover:text-gold transition-colors truncate">{poet.name}</p>
                    <p className="text-[11px] text-silver/60 mt-1">{poet.dynasty || '古典诗人'} · {poet.count} 首</p>
                  </Link>
                ))}
            </div>
          </div>
        </section>
      )}

      {/* ============ 页脚 ============ */}
      <footer className="py-12 px-6 lg:px-10 border-t border-darkline bg-ink">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="font-serif text-paper">诗境 Poetry Realm</p>
          <p className="text-xs text-silver">Powered by poetry-cli · doubao-cli AI 生图 · Vite + React</p>
        </div>
      </footer>
    </div>
  );
}