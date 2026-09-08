import SiteFooter from '../components/SiteFooter';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Layers } from 'lucide-react';
import { getTopics, type TopicMeta } from '../lib/api';

export default function Topics() {
  const [items, setItems] = useState<TopicMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTopics().then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-ink pb-24">
      <section className="relative py-24 px-6 lg:px-10 border-b border-darkline bg-[radial-gradient(ellipse_at_top,rgba(139,90,43,0.16),transparent_60%)]" style={{ backgroundImage: `linear-gradient(180deg, rgba(10,10,11,0.93) 0%, rgba(10,10,11,0.72) 40%, rgba(10,10,11,0.9) 80%, #0a0a0b 100%), url(/assets/bg/topics.jpg)`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="max-w-7xl mx-auto">
          <p className="text-xs tracking-[0.3em] text-gold uppercase mb-4">
            <span className="inline-flex items-center gap-1.5"><Layers size={12} /> Topics · 专题</span>
          </p>
          <h1 className="font-serif text-4xl md:text-5xl text-paper mb-6">专题</h1>
          <p className="text-silver max-w-2xl leading-relaxed">
            以经典选本为线索聚合诗作：每部选本一个专题，按知名度顺序一部一部做成沉浸页。
            已生成的篇目可直接沉浸阅读，其余可查看原文。专题体系可不断扩充。
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12 space-y-6">
        {loading ? (
          <div className="h-40 bg-ink-light border border-darkline rounded-2xl animate-pulse" />
        ) : items.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-darkline rounded-xl text-silver">
            暂无专题
          </div>
        ) : (
          items.map((t) => (
            <Link
              key={t.id}
              to={`/topic/${t.id}`}
              className="group block rounded-2xl border border-darkline hover:border-gold/50 transition-colors bg-ink-light/40 overflow-hidden"
            >
              <div className="p-8 lg:p-10">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span className="inline-flex items-center gap-1 text-[10px] tracking-widest uppercase text-gold border border-gold/40 rounded-full px-2.5 py-1">
                    <BookOpen size={10} />
                    {t.kind || '专题'}
                  </span>
                  <span className="text-xs text-silver/70">{t.short || t.id}</span>
                </div>
                <h2 className="font-serif text-3xl md:text-4xl text-paper group-hover:text-gold transition-colors">
                  {t.name}
                </h2>
                <p className="text-silver/85 leading-relaxed mt-3 max-w-3xl">{t.desc}</p>
                <div className="flex items-center justify-between flex-wrap gap-3 mt-6">
                  <p className="text-sm text-silver/80">
                    共 <span className="text-gold">{t.count ?? 0}</span> 篇 ·
                    已沉浸 <span className="text-gold">{t.done ?? 0}</span> 篇
                  </p>
                  <span className="inline-flex items-center gap-1.5 text-sm text-gold opacity-0 group-hover:opacity-100 transition-opacity">
                    进入专题 <ArrowRight size={15} />
                  </span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
      <SiteFooter />
    </div>
  );
}
