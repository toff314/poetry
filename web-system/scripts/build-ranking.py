#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""经典榜单 ranking.db 构建 v2：更鲁棒匹配。
唐诗三百首(data/tangshi300.txt) + 宋词三百首(本地微信读书导出章节序)。
匹配 poetry.db：
  - 作者：精确 → 别名表 → LIKE 退路（含无名氏/异体）
  - 标题：空白归一后双向 contains（DB 标题常带换行/空格/组序尾缀）
  - 宋词：首句探针清洗（去 □ 等乱码、标点）→ content 匹配；唯一命中优先
输出 ranking.db（rank 全局唯一=tang原号/song 1000+原号, source_no=榜内原序）。
用法: python3 scripts/build-ranking.py
"""
import re, json, sqlite3, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, 'data', 'poetry.db')
OUT = os.path.join(ROOT, 'data', 'ranking.db')
CN = {'一': 0, '二': 1, '三': 2, '四': 3, '五': 4, '六': 5, '七': 6, '八': 7, '九': 8, '十': 9}
SEASON = {'春': 0, '夏': 1, '秋': 2, '冬': 3}
AUTHOR_ALIAS = {
    '唐玄宗': '李隆基', '敦煌曲子词 无名氏': '无名氏', '敦煌曲子词·无名氏': '无名氏',
    '僧皎然': '皎然', '皎然': '皎然', '綦毋潜': '綦毋潜', '丘为': '丘为',
}
# 作者名全角/繁体小表：通用 LIKE 前 2 字已覆盖多数
_bad_author_cache = {}


def norm(s):
    return re.sub(r'\s+', '', s or '')

# 常见简繁/异体归一（宋词正文高频），用于 title/content/probe 比对
VF = str.maketrans({
    '锺': '钟', '沈': '沉', '着': '着', '阑': '阑', '簾': '帘', '樽': '尊', '瀟': '潇', '灑': '洒', '蕭': '萧',
    '樓': '楼', '夢': '梦', '箇': '个', '閑': '闲', '斷': '断', '處': '处', '歸': '归', '雲': '云',
    '風': '风', '東': '东', '華': '华', '楊': '杨', '臨': '临', '聲': '声', '聽': '听', '輕': '轻',
    '遠': '远', '還': '还', '頭': '头', '懷': '怀', '萬': '万', '開': '开', '門': '门', '問': '问',
    '聞': '闻', '間': '间', '閒': '闲', '長': '长', '飛': '飞', '馬': '马', '點': '点', '燈': '灯',
    '獨': '独', '幾': '几', '殘': '残', '興': '兴', '賞': '赏', '樂': '乐', '裏': '里', '個': '个',
    '卻': '却', '餘': '余', '紅': '红', '綠': '绿', '楊': '杨', '長': '长', '隴': '陇', '關': '关', '雙': '双',
    '鉢': '钵', '鐃': '铙', '牆': '墙', '臺': '台', '後': '后', '來': '来', '車': '车', '金': '金',
})


def norm(s):
    return re.sub(r'\s+', '', (s or '')).translate(VF)


def clean_probe(s):
    """去空白、书名号、引号、乱码 □■ 等，截前 12 字"""
    s = re.sub(r'[\s《》「」“”‘’□■]+', '', s or '')
    return s[:12]


def author_candidates(au):
    """返回 [作者名,...] 尝试顺序"""
    outs = [au]
    if au in AUTHOR_ALIAS:
        outs.insert(0, AUTHOR_ALIAS[au])
    return outs


def fetch_poems(db, author):
    """按作者拉取全部诗（id,title,content），缓存 per author"""
    key = author
    if key in _bad_author_cache:
        return _bad_author_cache[key]
    rows = db.execute('SELECT id,title,content FROM poems WHERE author=? ORDER BY id', (author,)).fetchall()
    if not rows and len(author) >= 2:
        rows = db.execute('SELECT id,title,content FROM poems WHERE author LIKE ? ORDER BY id', (author[:2] + '%',)).fetchall()
    if not rows and '无名氏' in author:
        rows = db.execute("SELECT id,title,content FROM poems WHERE author LIKE '%无名氏%' ORDER BY id").fetchall()
    _bad_author_cache[key] = rows
    return rows


def lcs_len(a, b):
    """最长公共连续子串长度"""
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
                if dp[j + 1] > best:
                    best = dp[j + 1]
            else:
                dp[j + 1] = 0
            prev = cur
    return best


def match_title(db, author, title):
    """标题匹配（唐诗）：双向 contains → 最长公共子串 → 短核心前缀兜底"""
    core = re.sub(r'[·・].*$', '', title or '')
    core_n = norm(core)
    if not core_n:
        return None
    short_cores = sorted(set([core_n[:6], core_n[:5], core_n[:4]]), key=len, reverse=True)
    for au in author_candidates(author):
        rows = fetch_poems(db, au)
        hits = []
        for pid, pt, _pc in rows:
            pt_n = norm(pt)
            if core_n in pt_n or pt_n in core_n:
                hits.append((pid, pt))
        if hits:
            return hits[min(group_index(title), len(hits) - 1)]
        for pid, pt, _pc in rows:
            pt_n = norm(pt)
            if len(pt_n) >= 4 and lcs_len(core_n, pt_n) >= max(6, min(len(core_n), len(pt_n)) - 2):
                hits.append((pid, pt))
        if hits:
            return hits[min(group_index(title), len(hits) - 1)]
        for sc in short_cores:  # 尾字/称谓差异：短前缀命中（宿业师山房待丁大/丁公）
            if len(sc) < 4:
                continue
            for pid, pt, _pc in rows:
                if sc in norm(pt):
                    hits.append((pid, pt))
            if hits:
                return hits[min(group_index(title), len(hits) - 1)]
    return None


def match_probe(db, author, probe):
    """首句探针：作者内逐候选（探针去前缀 0-2 字）找最少命中；唯一→返回；多→ content 起句优先；全库唯一兜底"""
    p0 = clean_probe(probe)
    cands = []
    for off in (0, 1, 2):
        c = p0[off:]
        if len(c) >= 2 and c not in cands:
            cands.append(c)
    if not cands:
        return None
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
            for pid, pt, pc in rows:  # 起句最贴近探针者
                pc0 = norm(pc or '')
                for c in cands:
                    if pc0.startswith(c):
                        return (pid, pt)
            return best[0]
    # 全库唯一命中兜底
    for c in cands:
        g = db.execute('SELECT id,title,author FROM poems WHERE instr(content, ?) > 0', (c,)).fetchall()
        if len(g) == 1:
            return (g[0][0], g[0][1])
    return None


def group_index(title):
    m = re.search(r'其([一二三四五六七八九十]+)$', title or '')
    if m: return CN.get(m.group(1), 0)
    m = re.search(r'([春夏秋冬])歌$', title or '')
    if m: return SEASON.get(m.group(1), 0)
    return 0


def load_tang():
    out = []
    for line in open(os.path.join(ROOT, 'data', 'tangshi300.txt'), encoding='utf-8'):
        line = line.strip()
        if not line or line.startswith('卷'):
            continue
        m = re.match(r'^(\d+)\.\s*(.+?)《(.+)》', line)
        if m:
            out.append((int(m.group(1)), m.group(2).strip(), m.group(3).strip()))
    return out


def load_songci():
    idx = '/tmp/songci-index.html'
    raw = open(idx, encoding='utf-8', errors='ignore').read() if os.path.exists(idx) else ''
    m = re.search(r'var chs = (\[.*?\]);', raw, re.S)
    chs = json.loads(m.group(1)) if m else []
    out, cur = [], ''
    skip = ('封面', '版权', '插图', '前言', '目录', '后记', '出版说明')
    for c in chs:
        t = (c.get('title') or '').strip()
        if not t or t in skip:
            continue
        if re.search(r'[（(]', t):
            if cur:
                pairs = re.findall(r'[（(]([^）)]*)[）)]', t)
                first = pairs[-1] if pairs else ''
                out.append((cur, t.strip(), first))
        else:
            cur = t
    return out


TITLE_ALIAS_DB = {
    '同从弟南斋玩月忆山阴崔少府': '同从弟销南斋玩月',
    '秦中寄远上人': '秦中感秋寄远上人',
    '酬程近秋夜即事见赠': '酬程延秋夜即事见赠',
    '江乡故人偶集客舍': '客夜与故人偶集',
    '和贾至舍人早朝大明宫之作': '奉和中书舍人贾至早朝大明宫',
}


def main():
    con = sqlite3.connect(DB)
    db = con.cursor()
    tang = load_tang()
    song = load_songci()
    print(f'唐诗 {len(tang)} | 宋词 {len(song)}')
    recs, unmatched = [], []  # (rank, source_no, source, dbid, title, author)
    for orig_no, author, title in tang:
        r = match_title(db, author, title)
        if not r and title in TITLE_ALIAS_DB:
            rows = db.execute('SELECT id,title FROM poems WHERE author=? AND instr(title,?)>0 ORDER BY id', (author, TITLE_ALIAS_DB[title])).fetchall()
            if not rows and len(author) >= 2:
                rows = db.execute('SELECT id,title FROM poems WHERE author LIKE ? AND instr(title,?)>0 ORDER BY id', (author[:2] + '%', TITLE_ALIAS_DB[title])).fetchall()
            if rows:
                r = (rows[0][0], rows[0][1])
        if r:
            recs.append((orig_no, orig_no, 'tangshi300', r[0], title, author))
        else:
            unmatched.append(('唐', author, title))
    for i, (author, pai, first) in enumerate(song, 1):
        r = match_probe(db, author, first)
        if r:
            recs.append((1000 + i, i, 'songci300', r[0], pai, author))
        else:
            unmatched.append(('宋', author, pai))

    if os.path.exists(OUT):
        os.remove(OUT)
    o = sqlite3.connect(OUT)
    o.execute("CREATE TABLE ranking (rank INTEGER PRIMARY KEY, source_no INTEGER, source TEXT, db_id TEXT, "
              "title TEXT, author TEXT, status TEXT DEFAULT 'pending', attempts INTEGER DEFAULT 0)")
    for g, no, src, did, ti, au in recs:
        o.execute('INSERT INTO ranking (rank, source_no, source, db_id, title, author) VALUES (?,?,?,?,?,?)',
                  (g, no, src, str(did), ti, au))
    o.commit()
    print(f'入库 {len(recs)}/{len(tang) + len(song)}，未匹配 {len(unmatched)}')
    from collections import Counter
    cnt = Counter(s for s, _, _ in unmatched)
    print('未匹配分布:', dict(cnt))
    for s, au, ti in unmatched:
        print(f'  [{s}] {au}《{ti}》')
    with open(os.path.join(ROOT, 'data', 'ranking-unmatched.txt'), 'w', encoding='utf-8') as f:
        for s, au, ti in unmatched:
            f.write(f'[{s}] {au}《{ti}》\n')
    o.close(); con.close()


if __name__ == '__main__':
    main()