#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""经典榜单 ranking.db 构建 v4：
  唐诗三百首(data/tangshi300.txt) + 宋词三百首(微信读书导出章节序)。
匹配 poetry.db（作者精确→LIKE 退路；组诗按序；标题/内容多策略）。
每篇附加 tags：选集 + 体裁/体制/风格，写 ranking.tags (JSON 数组)。
用法: python3 scripts/build-ranking.py
"""
import re, json, sqlite3, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, 'data', 'poetry.db')
OUT = os.path.join(ROOT, 'data', 'ranking.db')
CN = {'一': 0, '二': 1, '三': 2, '四': 3, '五': 4, '六': 5, '七': 6, '八': 7, '九': 8, '十': 9}
SEASON = {'春': 0, '夏': 1, '秋': 2, '冬': 3}
TITLE_ALIAS_DB = {
    '同从弟南斋玩月忆山阴崔少府': '同从弟销南斋玩月',
    '秦中寄远上人': '秦中感秋寄远上人',
    '酬程近秋夜即事见赠': '酬程延秋夜即事见赠',
    '江乡故人偶集客舍': '客夜与故人偶集',
    '和贾至舍人早朝大明宫之作': '奉和中书舍人贾至早朝大明宫',
}
VF = str.maketrans({
    '锺': '钟', '沈': '沉', '阑': '阑', '簾': '帘', '樽': '尊', '瀟': '潇', '灑': '洒', '蕭': '萧',
    '樓': '楼', '夢': '梦', '箇': '个', '閑': '闲', '斷': '断', '處': '处', '歸': '归', '雲': '云',
    '風': '风', '東': '东', '華': '华', '楊': '杨', '臨': '临', '聲': '声', '聽': '听', '輕': '轻',
    '遠': '远', '還': '还', '頭': '头', '懷': '怀', '萬': '万', '開': '开', '門': '门', '問': '问',
    '聞': '闻', '間': '间', '閒': '闲', '長': '长', '飛': '飞', '馬': '马', '點': '点', '燈': '灯',
    '獨': '独', '幾': '几', '殘': '残', '興': '兴', '賞': '赏', '樂': '乐', '裏': '里', '個': '个',
    '卻': '却', '餘': '余', '紅': '红', '綠': '绿', '隴': '陇', '關': '关', '雙': '双', '牆': '墙',
    '臺': '台', '後': '后', '來': '来', '車': '车', '閒': '闲',
})
HAO = {'苏轼', '辛弃疾', '陆游', '张元干', '岳飞', '陈亮', '刘克庄', '张孝祥', '叶梦得', '刘过', '蒋捷'}
WAN = {'柳永', '晏殊', '晏几道', '欧阳修', '秦观', '周邦彦', '李清照', '姜夔', '吴文英', '史达祖',
       '温庭筠', '李煜', '冯延巳', '韦庄', '牛峤', '牛希济', '毛滂', '张先', '贺铸', '宋祁',
       '赵佶', '范成大', '张炎', '王雱', '朱淑真', '舒亶', '白居易'}


def norm(s):
    return re.sub(r'\s+', '', (s or '')).translate(VF)


def lcs_len(a, b):
    if not a or not b:
        return 0
    m, n = len(a), len(b)
    dp = [0] * (n + 1)
    best = 0
    for i in range(m):
        prev = 0
        for j in range(n):
            cur = dp[j + 1]
            if a[i] == b[j]:
                dp[j + 1] = prev + 1
                best = max(best, dp[j + 1])
            else:
                dp[j + 1] = 0
            prev = cur
    return best


def group_index(title):
    m = re.search(r'其([一二三四五六七八九十]+)$', title or '')
    if m: return CN.get(m.group(1), 0)
    m = re.search(r'([春夏秋冬])歌$', title or '')
    if m: return SEASON.get(m.group(1), 0)
    return 0


_bad = {}


def fetch_poems(db, author):
    if author in _bad:
        return _bad[author]
    rows = db.execute('SELECT id,title,content FROM poems WHERE author=? ORDER BY id', (author,)).fetchall()
    if not rows and len(author) >= 2:
        rows = db.execute('SELECT id,title,content FROM poems WHERE author LIKE ? ORDER BY id', (author[:2] + '%',)).fetchall()
    _bad[author] = rows
    return rows


def author_candidates(au):
    outs = [au]
    if au in ('唐玄宗', '李隆基'):
        outs = ['李隆基']
    elif au.startswith('敦煌曲子词'):
        outs = ['无名氏', au]
    elif au == '僧皎然':
        outs = ['僧皎然', '皎然']
    return outs


def match_title(db, author, title):
    core = re.sub(r'[·・].*$', '', title or '')
    core_n = norm(core)
    if not core_n:
        return None
    short_cores = sorted({core_n[:6], core_n[:5], core_n[:4]}, key=len, reverse=True)
    for au in author_candidates(author):
        rows = fetch_poems(db, au)
        hits = []
        for pid, pt, _ in rows:
            pt_n = norm(pt)
            if core_n in pt_n or pt_n in core_n:
                hits.append((pid, pt))
        if hits:
            return hits[min(group_index(title), len(hits) - 1)]
        for pid, pt, _ in rows:
            pt_n = norm(pt)
            if len(pt_n) >= 4 and lcs_len(core_n, pt_n) >= max(6, min(len(core_n), len(pt_n)) - 2):
                hits.append((pid, pt))
        if hits:
            return hits[min(group_index(title), len(hits) - 1)]
        for sc in short_cores:
            if len(sc) < 4:
                continue
            hits = [(pid, pt) for pid, pt, _ in rows if sc in norm(pt)]
            if hits:
                return hits[min(group_index(title), len(hits) - 1)]
    return None


def match_probe(db, author, probe):
    p0 = re.sub(r'[\s《》「」“”‘’□■]+', '', probe or '')[:12].translate(VF)
    cands = []
    for off in (0, 1, 2):
        c = p0[off:]
        if len(c) >= 2 and c not in cands:
            cands.append(c)
    for au in author_candidates(author):
        rows = fetch_poems(db, au)
        best, best_n = None, 10 ** 9
        for c in cands:
            hits = [(pid, pt) for pid, pt, pc in rows if c in norm(pc)]
            if len(hits) == 1:
                return hits[0]
            if hits and len(hits) < best_n:
                best, best_n = hits, len(hits)
        if best:
            for pid, pt, pc in rows:
                for c in cands:
                    if norm(pc or '').startswith(c):
                        return (pid, pt)
            return best[0]
    for c in cands:
        g = db.execute('SELECT id,title,author FROM poems WHERE instr(content, ?) > 0', (c,)).fetchall()
        if len(g) == 1:
            return (g[0][0], g[0][1])
    return None


def tang_volumes():
    """source_no → 诗体（乐府并入对应古体）"""
    cur = None
    out = {}
    for line in open(os.path.join(ROOT, 'data', 'tangshi300.txt'), encoding='utf-8'):
        line = line.strip()
        if line.startswith('卷'):
            m = re.search(r'卷[一二三四五六]·(.+)', line)
            if not m:
                continue
            name = m.group(1)
            name = re.sub(r'（.*|\(.*', '', name)
            if '乐府' in name:
                name = name.replace('乐府', '古诗') if '律' not in name and '绝' not in name else name.replace('乐府', '')
            # 卷名规范
            mapping = {'五言古诗': '五言古诗', '七言古诗': '七言古诗', '五言律诗': '五言律诗',
                       '七言律诗': '七言律诗', '五言绝句': '五言绝句', '七言绝句': '七言绝句',
                       '五言乐府': '五言古诗', '七言乐府': '七言古诗'}
            cur = mapping.get(name, name)
            continue
        m = re.match(r'^(\d+)\.', line)
        if m and cur:
            out[int(m.group(1))] = cur
    return out


def song_style(author):
    if author in HAO:
        return '豪放'
    if author in WAN:
        return '婉约'
    return ''


def main():
    con = sqlite3.connect(DB)
    db = con.cursor()
    vol = tang_volumes()
    tang = []
    for line in open(os.path.join(ROOT, 'data', 'tangshi300.txt'), encoding='utf-8'):
        line = line.strip()
        if not line or line.startswith('卷'):
            continue
        m = re.match(r'^(\d+)\.\s*(.+?)《(.+)》', line)
        if m:
            tang.append((int(m.group(1)), m.group(2).strip(), m.group(3).strip()))
    song_raw = []
    idx = '/tmp/songci-index.html'
    raw = open(idx, encoding='utf-8', errors='ignore').read() if os.path.exists(idx) else ''
    mm = re.search(r'var chs = (\[.*?\]);', raw, re.S)
    chs = json.loads(mm.group(1)) if mm else []
    cur = ''
    skip = ('封面', '版权', '插图', '前言', '目录', '后记', '出版说明')
    for c in chs:
        t = (c.get('title') or '').strip()
        if not t or t in skip:
            continue
        if re.search(r'[（(]', t):
            if cur:
                pairs = re.findall(r'[（(]([^）)]*)[）)]', t)
                song_raw.append((cur, t.strip(), pairs[-1] if pairs else ''))
        else:
            cur = t
    print(f'唐诗 {len(tang)} | 宋词 {len(song_raw)}')

    recs, unmatched = [], []
    for orig_no, author, title in tang:
        r = match_title(db, author, title)
        if not r and title in TITLE_ALIAS_DB:
            rows = db.execute('SELECT id,title FROM poems WHERE author=? AND instr(title,?)>0 ORDER BY id', (author, TITLE_ALIAS_DB[title])).fetchall()
            if not rows and len(author) >= 2:
                rows = db.execute('SELECT id,title FROM poems WHERE author LIKE ? AND instr(title,?)>0 ORDER BY id', (author[:2] + '%', TITLE_ALIAS_DB[title])).fetchall()
            if rows:
                r = (rows[0][0], rows[0][1])
        if r:
            tags = ['唐诗三百首']
            body = vol.get(orig_no)
            if body:
                tags.append(body)
            recs.append((orig_no, orig_no, 'tangshi300', r[0], title, author, tags))
        else:
            unmatched.append(('唐', author, title))
    for i, (author, full, first) in enumerate(song_raw, 1):
        r = match_probe(db, author, first)
        if r:
            tags = ['宋词三百首']
            pc = None
            row = db.execute('SELECT content FROM poems WHERE id=?', (r[0],)).fetchone()
            pc = row[0] if row else ''
            L = len(re.sub(r'[\s，。！？、；：\n]', '', pc or ''))
            tags.append('小令' if L <= 58 else ('中调' if L <= 90 else '长调'))
            st = song_style(author)
            if st:
                tags.append(st)
            recs.append((1000 + i, i, 'songci300', r[0], full, author, tags))
        else:
            unmatched.append(('宋', author, full))

    if os.path.exists(OUT):
        os.remove(OUT)
    o = sqlite3.connect(OUT)
    o.execute("CREATE TABLE ranking (rank INTEGER PRIMARY KEY, source_no INTEGER, source TEXT, db_id TEXT, "
              "title TEXT, author TEXT, status TEXT DEFAULT 'pending', attempts INTEGER DEFAULT 0, tags TEXT DEFAULT '[]')")
    for g, no, src, did, ti, au, tags in recs:
        o.execute('INSERT INTO ranking (rank, source_no, source, db_id, title, author, tags) VALUES (?,?,?,?,?,?,?)',
                  (g, no, src, str(did), ti, au, json.dumps(tags, ensure_ascii=False)))
    o.commit()
    print(f'入库 {len(recs)}/{len(tang) + len(song_raw)}，未匹配 {len(unmatched)}')
    for s, au, ti in unmatched:
        print(f'  [{s}] {au}《{ti}》')
    with open(os.path.join(ROOT, 'data', 'ranking-unmatched.txt'), 'w', encoding='utf-8') as f:
        for s, au, ti in unmatched:
            f.write(f'[{s}] {au}《{ti}》\n')
    print('样例:', o.execute("SELECT title, tags FROM ranking WHERE source='tangshi300' AND title LIKE '%将进酒%'").fetchone(),
          o.execute("SELECT title, tags FROM ranking WHERE source='songci300' AND title LIKE '%青玉案%'").fetchall()[:1])
    o.close(); con.close()


if __name__ == '__main__':
    main()