import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, CheckCircle2 } from 'lucide-react';
import { getTopic, type TopicDetail } from '../lib/api';

type F = 'all' | 'done' | 'todo';

export default function Topic() {
  const { tag } = useParams<{ tag: string }>();
  const [d, setD] = useState<TopicDetail | null>(null);
  const [f, setF] = useState<F>('all');

  useEffect(() => {
    if (!tag) return;
    setD(null);
    setF('all');
    getTopic(tag).then(setD).catch(() => setD(null));
  }, [tag]);

  const items = useMemo(() => {
    if (!d) return [];
    if (f === 'done') return d.items.filter((i) => i.done);
    if (f === 'todo') return d.items.filter((i) => !i.done);
    return d.items;
  }, [d, f]);

  if (!tag) return null;

  return (
    <div className="min-h-screen bg-ink pb-28">
      {/* Hero */}
      <section className="relative pt-24 pb-10 px-6 lg:px-10 border-b border-darkline bg-[radial-gradient(ellipse_at_top,rgba(139,90,43,0.16),transparent_60%)]">
        <div className="max-w-7xl mx-auto">
          <Link to="/topics" className="inline-flex items-center gap-1.5 text-sm text-silver hover:text-gold transition-colors mb-6">
            <ArrowLeft size={15} />
            全部专题
          </Link>
          {d ? (
            <>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className="inline-flex items-center gap-1 text-[10px] tracking-widest uppercase text-gold border border-gold/40 rounded-full px-2.5 py-1">
                  <BookOpen size={10} />
                  {d.tag.kind || '专题'}
                </span>
                {d.tag.short && <span className="text-xs text-silver/70">{d.tag.short}</span>}
              </div>
              <h1 className="font-serif text-4xl md:text-5xl text-paper mb-5">{d.tag.name}</h1>
              {d.tag.desc && <p className="text-silver/85 max-w-3xl leading-relaxed mb-6">{d.tag.desc}</p>}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-silver/80">
                <span>共 <span className="text-gold">{d.total}</span> 篇</span>
                <span>已沉浸 <span className="text-gold">{d.doneCount}</span> 篇</span>
                <span>待生成 <span className="text-silver">{d.total - d.doneCount}</span> 篇</span>
              </div>
            </>
          ) : (
            <h1 className="font-serif text-4xl text-paper">专题加载中…</h1>
          )}
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-6">
        {/* 筛选 */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {(
            [
              ['all', '全部'],
              ['done', '已沉浸'],
              ['todo', '待生成'],
            ] as [F, string][]
          ).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setF(v)}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                f === v ? 'bg-gold text-ink border-gold' : 'border-darkline text-silver hover:border-silver'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {!d ? (
          <div className="h-40 bg-ink-light border border-darkline rounded-xl animate-pulse" />
        ) : items.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-darkline rounded-xl text-silver">没有匹配的篇目</div>
        ) : (
          <ul className="divide-y divide-darkline/60 border-y border-darkline/60">
            {items.map((it) => (
              <li key={it.dbId}>
                <Link
                  to={`/poem/${it.dbId}`}
                  className="flex items-center gap-4 px-2 py-2.5 group hover:bg-ink-light/60 transition-colors"
                >
                  <span className="w-14 shrink-0 text-right font-mono text-xs text-silver/60">{it.no}</span>
                  <span className="flex-1 min-w-0">
                    <span className={`font-serif text-base truncate block ${it.done ? 'text-paper' : 'text-paper/75'}`}>
                      {it.title}
                    </span>
                    <span className="text-xs text-silver/60">{it.author}</span>
                  </span>
                  {it.done ? (
                    <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-gold border border-gold/35 rounded-full px-2.5 py-1">
                      <CheckCircle2 size={11} />
                      已沉浸
                    </span>
                  ) : (
                    <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-silver/60 border border-darkline rounded-full px-2.5 py-1 group-hover:text-silver group-hover:border-silver/50">
                      待生成
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
