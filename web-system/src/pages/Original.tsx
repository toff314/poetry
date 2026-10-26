import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Feather, Loader2, Lock, LogOut, Play, ScanLine, Sparkles } from 'lucide-react';
import SiteFooter from '../components/SiteFooter';
import { authOriginalPassword, createOriginal, getOriginalIndex } from '../lib/api';
import type { OriginalSummary } from '../lib/api';

const TOKEN_KEY = 'original_token';

const WECHAT_QR = '/assets/wechat-toff314.jpg';

function formatDate(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function Original() {
  const [items, setItems] = useState<OriginalSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // 口令创作
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || '');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authing, setAuthing] = useState(false);

  // 创作表单（口令通过后显示）
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [definingLine, setDefiningLine] = useState('');
  const [intro, setIntro] = useState('');
  const [closing, setClosing] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [created, setCreated] = useState<{ id: string; title: string } | null>(null);

  const load = useCallback(() => {
    getOriginalIndex()
      .then((res) => setItems(res?.poems || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  const handleAuth = async () => {
    if (authing || !password) return;
    setAuthing(true);
    setAuthError('');
    try {
      const res = await authOriginalPassword(password);
      if (res?.token) {
        sessionStorage.setItem(TOKEN_KEY, res.token);
        setToken(res.token);
        setPassword('');
      } else {
        setAuthError('密码不正确');
      }
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : '验证失败，请稍后再试');
    } finally {
      setAuthing(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken('');
    setCreated(null);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!title.trim() || !content.trim()) {
      setSubmitError('标题和正文不能为空');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await createOriginal(token, {
        title: title.trim(),
        content: content.trim(),
        definingLine: definingLine.trim(),
        intro: intro.trim(),
        closing: closing.trim(),
      });
      if (res?.poem?.id) {
        setCreated({ id: res.poem.id, title: title.trim() });
        setTitle('');
        setContent('');
        setDefiningLine('');
        setIntro('');
        setClosing('');
        setLoading(true);
        load();
      } else {
        setSubmitError('保存失败，请重试');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '保存失败';
      setSubmitError(msg);
      if (/未授权|过期/.test(msg)) handleLogout();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink pb-24">
      {/* Hero */}
      <section
        className="relative py-24 px-6 lg:px-10 border-b border-darkline"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(10,10,11,0.93) 0%, rgba(10,10,11,0.72) 40%, rgba(10,10,11,0.9) 80%, #0a0a0b 100%), url(/assets/bg/topics.jpg)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="max-w-7xl mx-auto">
          <p className="text-xs tracking-[0.3em] text-gold uppercase mb-4">Original Works</p>
          <h1 className="font-serif text-4xl md:text-5xl text-paper mb-6">原创诗馆</h1>
          <p className="text-silver max-w-2xl leading-relaxed">
            这里收藏个人原创诗作，与古典诗词库分馆而立。点击进入沉浸页阅读；
            创作权由作者口令保管，想投稿可先扫码加微信。
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
        {/* 作品列表 */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="aspect-[16/10] bg-ink-light border border-darkline rounded-xl animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-darkline rounded-xl mb-12">
            <p className="text-silver">原创馆还没有作品</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7 mb-14">
            {items.map((g) => (
              <Link
                key={g.id}
                to={`/poem/${g.id}`}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-darkline hover:border-gold/40 transition-all bg-ink-light min-h-[300px]"
              >
                <div
                  className="flex-1 w-full flex flex-col items-center justify-center gap-3 px-6"
                  style={{ background: 'linear-gradient(135deg, #0a0a0b, #1a1410 45%, #3d2818)' }}
                >
                  <p className="font-serif text-3xl text-paper/90 tracking-[0.3em] poem-text">{g.title}</p>
                  {g.line && (
                    <p className="font-serif text-sm text-paper/70 px-6 text-center poem-text line-clamp-2">{g.line}</p>
                  )}
                </div>
                <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="w-11 h-11 rounded-full inline-flex items-center justify-center text-paper bg-paper/15 backdrop-blur-md border border-white/25 opacity-0 translate-y-1 scale-95 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 transition-all duration-200">
                    <Play size={15} fill="currentColor" />
                  </span>
                </span>
                <span className="absolute top-3 left-4 text-[10px] tracking-wider text-paper/90 bg-black/45 border border-white/15 px-2 py-1 rounded backdrop-blur-sm">
                  {g.dynasty || '原创'}
                </span>
                <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                  <p className="font-serif text-xl text-paper">{g.title}</p>
                  <p className="text-xs text-silver mt-1">
                    {g.author}
                    {g.createdAt ? ` · ${formatDate(g.createdAt)}` : ''}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* 创作区：口令或微信引导 */}
        <section className="border border-darkline rounded-xl bg-ink-light/60 p-6 lg:p-10">
          <div className="flex items-center gap-2 mb-2">
            <Feather size={18} className="text-gold" />
            <h2 className="font-serif text-2xl text-paper">作者创作</h2>
          </div>
          <p className="text-sm text-silver/80 mb-8">此馆仅作者本人可录入新诗。输入创作口令解锁录入表单。</p>

          {!token ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* 口令输入 */}
              <div>
                <label className="text-xs tracking-widest text-silver uppercase mb-3 block">创作口令</label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-silver" size={16} />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                      placeholder="输入口令"
                      className="w-full bg-ink border border-darkline rounded-lg pl-10 pr-4 py-2.5 text-sm text-paper placeholder-silver focus:border-gold focus:outline-none transition-colors"
                    />
                  </div>
                  <button
                    onClick={handleAuth}
                    disabled={authing || !password}
                    className="inline-flex items-center gap-2 bg-gold text-ink px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gold/90 disabled:opacity-60"
                  >
                    {authing ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                    解锁
                  </button>
                </div>
                {authError && <p className="mt-3 text-sm text-red-400">{authError}</p>}
              </div>

              {/* 微信引导 */}
              <div className="flex gap-5 items-start border border-dashed border-darkline rounded-xl p-5 bg-ink/40">
                <img
                  src={WECHAT_QR}
                  alt="作者微信二维码"
                  className="w-28 h-28 rounded-lg border border-darkline object-cover shrink-0"
                />
                <div>
                  <p className="flex items-center gap-2 text-sm text-paper mb-2">
                    <ScanLine size={16} className="text-gold" />
                    没有口令？
                  </p>
                  <p className="text-sm text-silver leading-relaxed">
                    扫码加作者微信，备注「原创」，聊聊你的诗。
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-gold">已解锁创作权限（本次会话有效）</p>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 text-xs text-silver hover:text-paper border border-darkline rounded-md px-3 py-1.5 transition-colors"
                >
                  <LogOut size={13} />
                  退出
                </button>
              </div>

              {created && (
                <div className="mb-6 flex flex-wrap items-center gap-3 border border-gold/40 bg-gold/10 rounded-lg px-4 py-3">
                  <p className="text-sm text-paper">《{created.title}》已入库。</p>
                  <Link to={`/poem/${created.id}`} className="inline-flex items-center gap-1 text-sm text-gold hover:underline">
                    进入沉浸页 <ArrowRight size={14} />
                  </Link>
                  <button className="text-xs text-silver hover:text-paper" onClick={() => setCreated(null)}>
                    收起
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs tracking-widest text-silver uppercase mb-2 block">标题 *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="诗题"
                    className="w-full bg-ink border border-darkline rounded-lg px-4 py-2.5 text-sm text-paper placeholder-silver focus:border-gold focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs tracking-widest text-silver uppercase mb-2 block">题眼（可选）</label>
                  <input
                    type="text"
                    value={definingLine}
                    onChange={(e) => setDefiningLine(e.target.value)}
                    placeholder="全诗最亮的一句，显示在卷首"
                    className="w-full bg-ink border border-darkline rounded-lg px-4 py-2.5 text-sm text-paper placeholder-silver focus:border-gold focus:outline-none transition-colors"
                  />
                </div>
                <div className="lg:col-span-2">
                  <label className="text-xs tracking-widest text-silver uppercase mb-2 block">正文 *（一行一句）</label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={8}
                    placeholder={'拾得亭西塔影长，\n低墙半尺纳山光。'}
                    className="w-full bg-ink border border-darkline rounded-lg px-4 py-2.5 text-sm text-paper placeholder-silver focus:border-gold focus:outline-none transition-colors font-serif leading-loose poem-text"
                  />
                </div>
                <div>
                  <label className="text-xs tracking-widest text-silver uppercase mb-2 block">小引（可选）</label>
                  <textarea
                    value={intro}
                    onChange={(e) => setIntro(e.target.value)}
                    rows={3}
                    placeholder="这首诗的来历与立意"
                    className="w-full bg-ink border border-darkline rounded-lg px-4 py-2.5 text-sm text-paper placeholder-silver focus:border-gold focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs tracking-widest text-silver uppercase mb-2 block">后记（可选）</label>
                  <textarea
                    value={closing}
                    onChange={(e) => setClosing(e.target.value)}
                    rows={3}
                    placeholder="读诗札记、注释"
                    className="w-full bg-ink border border-darkline rounded-lg px-4 py-2.5 text-sm text-paper placeholder-silver focus:border-gold focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-4">
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 bg-gold text-ink px-6 py-3 rounded-lg text-sm font-medium hover:bg-gold/90 disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="animate-spin" size={18} /> : <Feather size={18} />}
                  {submitting ? '入库中…' : '录入原创馆'}
                </button>
                {submitError && <p className="text-sm text-red-400">{submitError}</p>}
              </div>
            </div>
          )}
        </section>
      </div>

      <SiteFooter />
    </div>
  );
}
