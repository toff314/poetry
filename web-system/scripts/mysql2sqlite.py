#!/usr/bin/env python3
"""mysql2sqlite.py — 将 chinese-poetry-collection8.sql (MySQL/Navicat dump) 转换为 SQLite。

用法: python3 mysql2sqlite.py <input.sql> <output.db>
保留原始表结构与 id，正文/标题保持 dump 原样（繁体）。
"""
import re
import sqlite3
import sys

TABLES = {
    "author": ["a_id", "a_name", "a_dynasty_id", "a_img_path"],
    "collection": ["c_id", "c_name", "c_note"],
    "dynasty": ["d_id", "d_name", "d_img_path"],
    "poetry": [
        "p_id", "p_title", "p_author_id", "p_rhythmic_id", "p_paragraph",
        "p_note", "p_collection_id", "p_other", "p_img_path",
    ],
    "rhythmic": ["r_id", "r_name", "r_note", "r_img_path"],
}


def unescape(s: str) -> str:
    """还原 MySQL 字符串字面量内容（去外层引号 + 转义还原）。"""
    # 输入为带单引号的原始字面量片段
    out = []
    i = 0
    n = len(s)
    while i < n:
        c = s[i]
        if c == "'":
            # '' -> '；\' -> '
            if i + 1 < n and s[i + 1] == "'":
                out.append("'")
                i += 2
                continue
            # 不可能的单引号（应成对），保守丢弃
            i += 1
            continue
        if c == "\\" and i + 1 < n:
            nx = s[i + 1]
            if nx == "n":
                out.append("\n"); i += 2; continue
            if nx == "r":
                out.append("\r"); i += 2; continue
            if nx == "t":
                out.append("\t"); i += 2; continue
            if nx == "0":
                out.append("\0"); i += 2; continue
            if nx == "\\":
                out.append("\\"); i += 2; continue
            if nx == "'":
                out.append("'"); i += 2; continue
            if nx == '"':
                out.append('"'); i += 2; continue
        out.append(c)
        i += 1
    return "".join(out)


def parse_insert_tuples(stmt: str):
    """解析 'INSERT INTO `t` VALUES (...),(...);' 为 Python 值列表。"""
    values_pos = stmt.find("VALUES")
    if values_pos == -1:
        return []
    chunk = stmt[values_pos + len("VALUES"):]
    rows = []
    i = 0
    n = len(chunk)
    while i < n:
        # 找下一个 tuple 的起始 '('
        while i < n and chunk[i] != "(":
            i += 1
        if i >= n:
            break
        j = i + 1
        depth = 1
        fields = []
        cur = []
        in_str = False
        while j < n:
            c = chunk[j]
            if in_str:
                if c == "\\" and j + 1 < n and chunk[j + 1] in ("'", "\\"):
                    cur.append(c)
                    cur.append(chunk[j + 1])
                    j += 2
                    continue
                if c == "'":
                    if j + 1 < n and chunk[j + 1] == "'":
                        cur.append("''")
                        j += 2
                        continue
                    in_str = False
                    cur.append("'")
                else:
                    cur.append(c)
                j += 1
                continue
            if c == "'":
                in_str = True
                cur.append("'")
                j += 1
                continue
            if c == "(":
                depth += 1
                cur.append(c)
                j += 1
                continue
            if c == ")":
                depth -= 1
                if depth == 0:
                    fields.append("".join(cur).strip())
                    break
                cur.append(c)
                j += 1
                continue
            if c == "," and depth == 1:
                fields.append("".join(cur).strip())
                cur = []
                j += 1
                continue
            cur.append(c)
            j += 1
        if fields:
            vals = []
            for f in fields:
                if f == "NULL":
                    vals.append(None)
                elif f.startswith("'") and f.endswith("'") and len(f) >= 2:
                    vals.append(unescape(f[1:-1]))
                else:
                    try:
                        vals.append(int(f))
                    except ValueError:
                        vals.append(f)
            rows.append(vals)
        i = j + 1
    return rows



def main():
    src, dst = sys.argv[1], sys.argv[2]
    con = sqlite3.connect(dst)
    con.executescript("PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; PRAGMA temp_store=MEMORY;")
    cur = con.cursor()
    for table, cols in TABLES.items():
        coldefs = ", ".join(f'"{c}"' for c in cols)
        cur.execute(f'DROP TABLE IF EXISTS "{table}"')
        cur.execute(f'CREATE TABLE "{table}" ({coldefs})')
    con.commit()

    counts = {t: 0 for t in TABLES}
    buf = []
    with open(src, "r", encoding="utf-8") as f:
        pending = ""
        for line in f:
            line = line.rstrip("\n")
            if line.startswith("INSERT INTO"):
                pending = line
            elif pending:
                pending += line
            # 语句以 ');' 结尾（带分号）即处理
            if pending and pending.rstrip().endswith(";"):
                m = re.match(r"INSERT INTO `(\w+)` VALUES", pending)
                if m:
                    table = m.group(1)
                    if table in TABLES:
                        rows = parse_insert_tuples(pending)
                        if rows:
                            buf.append((table, rows))
                pending = ""
            if len(buf) >= 40:
                flush(con, cur, buf, counts)
                buf = []
    if buf:
        flush(con, cur, buf, counts)
    con.commit()
    print("完成，各表行数:")
    for t in TABLES:
        print(f"  {t}: {counts[t]}")
    con.close()


def flush(con, cur, buf, counts):
    for table, rows in buf:
        ncols = len(TABLES[table])
        placeholders = ",".join("?" * ncols)
        rows = [r[:ncols] for r in rows]
        cur.executemany(
            f'INSERT INTO "{table}" VALUES ({placeholders})', rows
        )
        counts[table] += len(rows)
    con.commit()


if __name__ == "__main__":
    main()