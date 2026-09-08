import { useEffect, useState } from 'react';
import { getRankByDb, findRankByTitle, tagLabel, type RankInfo } from '../lib/api';

/** 三百首标签：优先按 dbId 查榜；未命中按作者+题名兜底（兼容旧 UUID 场景）。不在榜返回 null。 */
export default function TagPill({
  dbId,
  author,
  title,
  withNo = false,
  className = '',
}: {
  dbId?: string;
  author?: string;
  title?: string;
  withNo?: boolean;
  className?: string;
}) {
  const [info, setInfo] = useState<RankInfo | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      let r: RankInfo | null = dbId ? await getRankByDb(dbId) : null;
      if (!r && author && title) r = await findRankByTitle(author, title);
      if (alive) setInfo(r);
    })();
    return () => {
      alive = false;
    };
  }, [dbId, author, title]);

  if (!info) return null;
  const no = info.no ?? info.rank;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] tracking-wide text-gold border border-gold/30 rounded-full px-2 py-0.5 bg-black/35 whitespace-nowrap ${className}`}
    >
      {tagLabel(info.source)}
      {withNo ? ` · 第 ${no} 位` : ''}
    </span>
  );
}
