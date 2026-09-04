#!/usr/bin/env node
/**
 * build-poetry-db.mjs — 从 poetry-raw.db（MySQL dump 转换的繁体全集）物化精选简体库。
 *
 * 精选范围（B 档）：
 *   1) 词曲小集全收：宋词(2.1万)、花间、南唐、诗经、曹操、楚辞、纳兰性德
 *   2) 唐宋诗人白名单全集（繁体名先转简体归一后匹配）
 *   3) 超大诗人（陆游/杨万里等）截断，控制总量在 ~4-5 万
 * 全部内容简体化（opencc tw→cn），id 复用 dump 的 p_id（稳定）。
 *
 * 用法: node scripts/build-poetry-db.mjs <raw.db> <out.db>
 */
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import OpenCC from 'opencc-js';

const [, , RAW_PATH, OUT_PATH] = process.argv;
if (!RAW_PATH || !OUT_PATH) {
  console.error('Usage: node scripts/build-poetry-db.mjs <raw.db> <out.db>');
  process.exit(1);
}

const conv = OpenCC.Converter({ from: 'tw', to: 'cn' });
const cn = (s) => (typeof s === 'string' ? conv(s) : s);

// 全收的诗集 collection id（宋词/诗经/曹操/南唐/花间/楚辞/纳兰性德）
const FULL_COLLECTIONS = [7, 8, 9, 10, 11, 13, 15];

// 唐宋诗诗人白名单（简体）
const POETS = [
  // 唐
  '王绩','王勃','卢照邻','骆宾王','杨炯','宋之问','沈佺期','张九龄','贺知章',
  '陈子昂','张若虚','王之涣','王翰','孟浩然','李颀','王昌龄','常建','祖咏','王维',
  '崔颢','刘长卿','李白','杜甫','岑参','高适','张继','钱起','韩翃','韦应物','卢纶',
  '李益','孟郊','张籍','王建','韩愈','刘禹锡','白居易','柳宗元','元稹','贾岛',
  '李贺','许浑','杜牧','李商隐','温庭筠','罗隐','陆龟蒙','皮日休','韦庄','张祜',
  '顾况','戴叔伦','李端','司空曙','刘方平',
  // 宋（诗）
  '林逋','范仲淹','梅尧臣','欧阳修','苏舜钦','曾巩','王安石','苏轼','苏辙','黄庭坚',
  '张耒','秦观','贺铸','陈师道','陈与义','范成大','朱熹','文天祥','叶绍翁',
  '赵师秀','徐玑','翁卷','林升',
  // 超大作者全集截断（首 N 首），保持库的密度
];

// 超大诗人截断上限：陆游/杨万里全宋诗体量过大，取代表性子集
const LIMIT_BY_POET = new Map([
  ['陆游', 1200],
  ['杨万里', 1500],
  ['范成大', 1800],
]);

const raw = new DatabaseSync(RAW_PATH, { readOnly: true });

// 1. author / dynasty / collection 简表
const authors = raw.prepare('SELECT a_id, a_name, a_dynasty_id FROM author').all();
const dynasties = raw.prepare('SELECT d_id, d_name FROM dynasty').all();
const dynName = new Map(dynasties.map((d) => [d.d_id, cn(d.d_name) || '']));
const authorById = new Map();
for (const a of authors) {
  authorById.set(a.a_id, { name: cn(a.a_name), dynasty: dynName.get(a.a_dynasty_id) || '' });
}

// 匹配名单作者（名字先简体归一）
const matchedAuthorIds = new Set();
for (const a of authors) {
  const simp = cn(a.a_name);
  if (POETS.includes(simp)) matchedAuthorIds.add(a.a_id);
}
console.log(`作者白名单匹配: ${matchedAuthorIds.size} 条 author 记录`);

// 2. 收集诗 id 集合（SQL 一次取）
const placeholders = [...FULL_COLLECTIONS.map(() => '?'), ...Array(matchedAuthorIds.size).fill('?')].join(',');
const params = [...FULL_COLLECTIONS, ...matchedAuthorIds];
const stmt = raw.prepare(`
  SELECT p.p_id, p.p_title, p.p_author_id, p.p_paragraph, p.p_collection_id, r.r_name AS rhythmic
  FROM poetry p
  LEFT JOIN rhythmic r ON p.p_rhythmic_id = r.r_id
  WHERE p.p_collection_id IN (${FULL_COLLECTIONS.map(() => '?').join(',')})
     OR p.p_author_id IN (${Array(matchedAuthorIds.size).fill('?').join(',')})
`);
const rows = stmt.all(...params);
console.log(`命中行: ${rows.length}`);

// 3. 简体化 + title 兜底 + 作者截断
const out = new DatabaseSync(OUT_PATH);
out.exec(`
  PRAGMA journal_mode=OFF;
  PRAGMA synchronous=OFF;
  DROP TABLE IF EXISTS poems;
  DROP TABLE IF EXISTS poets;
  CREATE TABLE IF NOT EXISTS poems(
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    dynasty TEXT DEFAULT '',
    genre TEXT DEFAULT '',
    content TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_poems_author ON poems(author);
  CREATE INDEX IF NOT EXISTS idx_poems_title ON poems(title);
`);
out.exec('BEGIN');
const ins = out.prepare('INSERT OR IGNORE INTO poems(id,title,author,dynasty,genre,content) VALUES(?,?,?,?,?,?)');
const perAuthor = new Map();
let inserted = 0;
let skippedDup = 0;

const collectionGenre = new Map([
  [7, '词'], [8, '诗经'], [9, '诗'], [10, '词'], [11, '词'], [13, '楚辞'], [15, '词'],
]);

const ANON_BY_COLLECTION = new Map([
  [8, '诗经'], [13, '楚辞'], [9, '曹操'], [7, '佚名'], [11, '佚名'], [10, '佚名'], [15, '佚名'],
]);
for (const r of rows) {
  const meta = authorById.get(r.p_author_id);
  let author;
  if (meta && meta.name) {
    author = meta.name;
  } else {
    author = ANON_BY_COLLECTION.get(r.p_collection_id) || '佚名';
  }
  // 作者截断
  const limit = LIMIT_BY_POET.get(author);
  if (limit !== undefined) {
    const n = perAuthor.get(author) || 0;
    if (n >= limit) continue;
    perAuthor.set(author, n + 1);
  }
  const rawTitle = (r.p_title || '').trim();
  const titleRaw = rawTitle || r.rhythmic || '';
  const contentRaw = (r.p_paragraph || '').trim();
  if (!contentRaw) continue;
  const content = cn(contentRaw);
  const title = titleRaw ? cn(titleRaw) : content.split(/[。！？\n]/)[0].slice(0, 14);
  const genre = collectionGenre.get(r.p_collection_id) || '';
  const dynasty = meta && meta.dynasty ? meta.dynasty : '';
  const id = String(r.p_id);
  ins.run(id, title, author, dynasty, genre, content);
  inserted++;
}

out.exec('COMMIT');
const total = out.prepare('SELECT COUNT(*) n FROM poems').get().n;
const dup = inserted - total;
console.log(`写入: ${total} 首（跳过重复/空 ${dup}）`);

// 4. poets 聚合
out.exec(`CREATE TABLE IF NOT EXISTS poets(
  name TEXT PRIMARY KEY,
  dynasty TEXT DEFAULT '',
  count INTEGER DEFAULT 0
)`);
out.exec('BEGIN');
const agg = out.prepare(
  `INSERT OR REPLACE INTO poets(name, dynasty, count)
   SELECT author, MAX(dynasty), COUNT(*) FROM poems GROUP BY author`
);
agg.run();
out.exec('COMMIT');
const poetCount = out.prepare('SELECT COUNT(*) n FROM poets').get().n;
console.log(`诗人聚合: ${poetCount} 位`);

// 5. 统计
const byGenre = out.prepare("SELECT genre, COUNT(*) n FROM poems GROUP BY genre ORDER BY 2 DESC").all();
console.log('体裁分布:', byGenre.map((g) => `${g.genre || '诗'}:${g.n}`).join(', '));
const byDyn = out.prepare("SELECT dynasty, COUNT(*) n FROM poems GROUP BY dynasty ORDER BY 2 DESC").all();
console.log('朝代分布:', byDyn.map((d) => `${d.dynasty || '未知'}:${d.n}`).join(', '));
const top = out.prepare("SELECT name, count FROM poets ORDER BY count DESC LIMIT 12").all();
console.log('存诗 Top12:', top.map((p) => `${p.name}(${p.count})`).join(' '));

out.close();
raw.close();
console.log(`已生成: ${OUT_PATH}`);
