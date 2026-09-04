import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';
import http from 'node:http';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = path.join(__dirname, 'data', 'generated');
const POETRY_DB = process.env.POETRY_DB || path.join(__dirname, 'data', 'poetry.db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// 轻量 .env 加载（无 dotenv 依赖）：web-system/.env → process.env（已存在则不覆盖）
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  for (const raw of fs.readFileSync(envFile, 'utf-8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(raw);
    if (!m || process.env[m[1]] !== undefined) continue;
    let v = m[2].trim();
    if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) v = v.slice(1, -1);
    if (v) process.env[m[1]] = v;
  }
}

// ── SQLite 诗词库（精选简体库，node:sqlite 内置） ──────────────────
const db = new DatabaseSync(POETRY_DB, { readOnly: true });
const TOTAL_POEMS = db.prepare('SELECT COUNT(*) n FROM poems').get().n;
const ALL_POETS = db
  .prepare('SELECT name, dynasty, count FROM poets ORDER BY count DESC')
  .all()
  .filter((p) => p && typeof p.name === 'string');

const stmt = {
  random: db.prepare('SELECT id, title, author, dynasty, content FROM poems ORDER BY RANDOM() LIMIT 1'),
  poemById: db.prepare('SELECT id, title, author, dynasty, content FROM poems WHERE id = ?'),
  listByAuthor: db.prepare('SELECT id, title, author, dynasty, content FROM poems WHERE author = ? ORDER BY id LIMIT ? OFFSET ?'),
  countByAuthor: db.prepare('SELECT COUNT(*) n FROM poems WHERE author = ?'),
  search: db.prepare("SELECT id, title, author, dynasty, content FROM poems WHERE instr(title, ?) > 0 OR instr(author, ?) > 0 OR instr(content, ?) > 0 LIMIT ? OFFSET ?"),
  countSearch: db.prepare("SELECT COUNT(*) n FROM poems WHERE instr(title, ?) > 0 OR instr(author, ?) > 0 OR instr(content, ?) > 0"),
};

console.log(`Poetry DB: ${TOTAL_POEMS} 首诗, ${ALL_POETS.length} 位诗人`);

// ── generated 页面索引 ──────────────────────────────────────────────
function getGeneratedIndex() {
  const file = path.join(GENERATED_DIR, 'index.json');
  if (!fs.existsSync(file)) return { poems: [] };
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

// 朝代口径归一（不同期生成数据写法不一）
const DYN_MAP = {
  盛唐: '唐朝', 初唐: '唐朝', 中唐: '唐朝', 晚唐: '唐朝',
  北宋: '宋朝', 南宋: '宋朝', 五代十国: '五代', 先秦: '春秋战国',
};
const POETS_BY_NAME = new Map(ALL_POETS.map((p) => [p.name, p.dynasty]));
function normDynasty(raw, author) {
  const m = DYN_MAP[raw] || raw;
  if (m && m !== '古诗') return m;
  return POETS_BY_NAME.get(author) || '';
}

function poemToDto(row) {
  return {
    id: String(row.id),
    title: row.title,
    author: row.author,
    dynasty: row.dynasty || '',
    content: row.content,
  };
}

// ── API ─────────────────────────────────────────────────────────────
// ── Umami 上报转发：页面同源打到本站 /api/send，再转发到自托管 Umami ──
const UMAMI_URL = process.env.UMAMI_URL || 'http://localhost:8765';
app.post('/api/send', (req, res) => {
  try {
    const body = JSON.stringify(req.body || {});
    const u = new URL(`${UMAMI_URL}/api/send`);
    const r = http.request(
      { hostname: u.hostname, port: u.port, path: u.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      (rr) => {
        res.status(rr.statusCode || 200).end();
        rr.resume();
      }
    );
    r.on('error', () => res.status(502).end());
    r.write(body);
    r.end();
  } catch {
    res.status(500).end();
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/poets', (_req, res) => {
  try {
    res.json({ success: true, data: { poets: ALL_POETS } });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/poems/random', (_req, res) => {
  try {
    const poem = stmt.random.get();
    if (!poem) return res.status(404).json({ error: 'empty db' });
    res.json({ success: true, data: { type: 'random', poem: poemToDto(poem) } });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/poems/:poet', (req, res) => {
  try {
    const poet = req.params.poet;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const total = stmt.countByAuthor.get(poet)?.n || 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const poems = stmt.listByAuthor.all(poet, limit, (page - 1) * limit).map(poemToDto);
    res.json({
      success: true,
      data: { type: 'show', poet, total, page, limit, total_pages: totalPages, poems },
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/poem/:id', (req, res) => {
  try {
    const poem = stmt.poemById.get(req.params.id);
    if (!poem) return res.status(404).json({ error: 'not found' });
    res.json({ success: true, data: { poem: poemToDto(poem) } });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/search', (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim();
    if (!q) return res.json({ success: true, data: { poems: [], total: 0, page: 1, limit: 0, total_pages: 0 } });
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const total = stmt.countSearch.get(q, q, q)?.n || 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const poems = stmt.search.all(q, q, q, limit, (page - 1) * limit).map(poemToDto);
    res.json({
      success: true,
      data: { query: q, total, page, limit, total_pages: totalPages, poems },
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── 诗词库组合筛选（朝代 × 诗人 × 关键词，任意叠加） ─────────────
function buildPoemFilter({ dynasty = '', poet = '', q = '' }) {
  const where = [];
  const params = [];
  if (dynasty) {
    // 「其他」= 无朝代（poets.dynasty 为空串，如《诗经》305 首）；同时兼容库里真有 '其他' 字样
    where.push(dynasty === '其他' ? "(dynasty = '' OR dynasty = '其他')" : 'dynasty = ?');
    if (dynasty !== '其他') params.push(dynasty);
  }
  if (poet) { where.push('author = ?'); params.push(poet); }
  if (q) {
    where.push('(instr(title, ?) > 0 OR instr(author, ?) > 0 OR instr(content, ?) > 0)');
    params.push(q, q, q);
  }
  return { whereSql: where.length ? ` WHERE ${where.join(' AND ')}` : '', params };
}

app.get('/api/library', (req, res) => {
  try {
    const dynasty = (req.query.dynasty || '').toString().trim();
    const poet = (req.query.poet || '').toString().trim();
    const q = (req.query.q || '').toString().trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 24));
    const { whereSql, params } = buildPoemFilter({ dynasty, poet, q });
    const base = `SELECT id, title, author, dynasty, content FROM poems${whereSql}`;
    const total = db.prepare(`SELECT COUNT(*) n FROM poems${whereSql}`).get(...params)?.n || 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const poems = db
      .prepare(`${base} ORDER BY id LIMIT ? OFFSET ?`)
      .all(...params, limit, (page - 1) * limit)
      .map(poemToDto);
    res.json({ success: true, data: { dynasty, poet, q, total, page, limit, total_pages: totalPages, poems } });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── 网友弹幕留言（按诗分房间，本地 SQLite） ──────────────────────────
const DANMAKU_DB = process.env.DANMAKU_DB || path.join(__dirname, 'data', 'danmaku.db');
const ddb = new DatabaseSync(DANMAKU_DB);
ddb.exec(`
  CREATE TABLE IF NOT EXISTS danmaku (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poem_id TEXT NOT NULL,
    nickname TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_danmaku_poem ON danmaku(poem_id, created_at);
`);
const stmtDmInsert = ddb.prepare('INSERT INTO danmaku (poem_id, nickname, content, created_at) VALUES (?, ?, ?, ?)');
const stmtDmByPoem = ddb.prepare('SELECT id, nickname, content, created_at AS createdAt FROM danmaku WHERE poem_id = ? AND id > ? ORDER BY id ASC LIMIT ?');
const stmtDmLatest = ddb.prepare('SELECT id, nickname, content, created_at AS createdAt FROM danmaku WHERE poem_id = ? ORDER BY id DESC LIMIT ?');
// 每 IP 限流：60 秒内最多 20 条
const dmRate = new Map();
function dmRateOk(ip) {
  const now = Date.now();
  const arr = (dmRate.get(ip) || []).filter((t) => now - t < 60000);
  if (arr.length >= 20) { dmRate.set(ip, arr); return false; }
  arr.push(now);
  dmRate.set(ip, arr);
  return true;
}

app.get('/api/poem/:id/danmaku', (req, res) => {
  try {
    const poemId = String(req.params.id || '').slice(0, 40);
    const after = Math.max(0, Number(req.query.after) || 0);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
    const rows = after > 0
      ? stmtDmByPoem.all(poemId, after, limit)
      : stmtDmLatest.all(poemId, limit).reverse();
    res.json({
      success: true,
      data: { poemId, items: rows, nextId: rows.length ? rows[rows.length - 1].id : after },
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/poem/:id/danmaku', (req, res) => {
  try {
    const poemId = String(req.params.id || '').slice(0, 40);
    const nickname = String(req.body?.nickname || '').trim().replace(/[\r\n\t]/g, ' ').slice(0, 16);
    const content = String(req.body?.content || '').trim().replace(/\s+/g, ' ').slice(0, 120);
    if (!poemId) return res.status(400).json({ error: '缺少诗词 id' });
    if (!nickname) return res.status(400).json({ error: '昵称不能为空' });
    if (!content) return res.status(400).json({ error: '留言内容不能为空' });
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local';
    if (!dmRateOk(String(ip))) return res.status(429).json({ error: '发送太频繁，请稍后再试' });
    const ts = Date.now();
    const r = stmtDmInsert.run(poemId, nickname, content, ts);
    res.json({ success: true, data: { item: { id: Number(r.lastInsertRowid), nickname, content, createdAt: ts } } });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── AI 视频生成任务（火山 Ark seedance，逐图×诗句 = 逐段视频） ─────
const VIDEO_DIR = path.join(__dirname, 'data', 'videos');
const VIDEO_SCRIPT = path.join(__dirname, 'scripts', 'generate-video.mjs');

function readVideoTask(taskId) {
  const f = path.join(VIDEO_DIR, `${taskId}.json`);
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, 'utf-8'));
}

app.post('/api/video/:id', async (req, res) => {
  try {
    const rawId = req.params.id;
    const existing = readVideoTask(rawId);
    if (existing && existing.status === 'running') {
      return res.json({ success: true, taskId: rawId, status: 'running' });
    }
    // 前置配置检查（给出可读错误）
    if (!process.env.ARK_API_KEY) {
      return res.status(400).json({ success: false, error: '未配置 ARK_API_KEY（web-system/.env）' });
    }
    if (!process.env.PUBLIC_ASSET_BASE) {
      return res.status(400).json({ success: false, error: '未配置 PUBLIC_ASSET_BASE：生成视频需要图片的公网可访问 URL 前缀（如 https://你的资源站）' });
    }
    fs.mkdirSync(VIDEO_DIR, { recursive: true });
    fs.writeFileSync(path.join(VIDEO_DIR, `${rawId}.json`), JSON.stringify({ status: 'running', stage: 'queued', progress: 0, detail: '排队中…', poemId: rawId, clips: [], startedAt: Date.now() }));
    const { spawn } = await import('child_process');
    // 默认 --avatar auto：脚本按作者(诗人)选主形象出演；可 body.avatar 覆盖
    const avatarArg = String(req.body?.avatar || 'auto');
    const child = spawn('node', [VIDEO_SCRIPT, rawId, '--task', rawId, '--avatar', avatarArg], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    child.stdout.on('data', (d) => { log += d; });
    child.stderr.on('data', (d) => { log += d; });
    child.on('error', (e) => {
      const cur = readVideoTask(rawId) || {};
      fs.writeFileSync(path.join(VIDEO_DIR, `${rawId}.json`), JSON.stringify({ ...cur, status: 'error', error: String(e) }, null, 2));
    });
    child.on('exit', (code) => {
      const cur = readVideoTask(rawId);
      if (code !== 0 && cur && cur.status !== 'done' && cur.status !== 'error') {
        fs.writeFileSync(path.join(VIDEO_DIR, `${rawId}.json`), JSON.stringify({ ...cur, status: 'error', stage: 'exit', error: `视频任务异常退出 (code ${code})：${log.slice(-400)}` }, null, 2));
      }
    });
    res.json({ success: true, taskId: rawId, status: 'running' });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// 诗人出演形象（主 + 备选）：按作者映射，供页面展示与生成选角
app.get('/api/avatars/:id', (req, res) => {
  try {
    const gid = req.params.id;
    const genFile = path.join(GENERATED_DIR, `${gid}.json`);
    let author = '';
    if (fs.existsSync(genFile)) {
      try { const g = JSON.parse(fs.readFileSync(genFile, 'utf-8')); author = g?.author || ''; } catch { /* keep */ }
    }
    const avFile = path.join(__dirname, 'avatars.json');
    const av = JSON.parse(fs.readFileSync(avFile, 'utf-8'));
    const byId = (id) => (av.items || []).find((i) => i.id === id) || null;
    const pm = (av.poets || {})[author];
    let main = null;
    let supports = [];
    if (pm && pm.main) {
      main = byId(pm.main);
      supports = (pm.supports || []).map(byId).filter(Boolean);
    } else {
      const cand = (av.items || []).filter((i) => i.ancient === true && i.id);
      const h = (s) => { let x = 0; for (const ch of String(s)) x = (x * 31 + ch.codePointAt(0)) >>> 0; return x; };
      main = byId(cand[h(gid) % cand.length]?.id) || byId('asset-20260804202330-bps7t');
    }
    if (!supports.length) supports = (av.items || []).filter((i) => i.ancient === true).slice(0, 3).map(byId).filter(Boolean);
    res.json({ success: true, data: { poemId: gid, author, main, supports } });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/video/:id', (req, res) => {
  try {
    const t = readVideoTask(req.params.id);
    if (!t) return res.status(404).json({ error: 'no such video task' });
    res.json(t);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/generated', (_req, res) => {
  try {
    const index = getGeneratedIndex();
    const poems = (index.poems || []).map((p) => {
      let hasArt = false;
      let cover = '';
      let line = '';
      let dynasty = '';
      try {
        const file = path.join(GENERATED_DIR, `${p.id}.json`);
        if (fs.existsSync(file)) {
          const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
          const hero = data && typeof data.heroImage === 'string' ? data.heroImage : '';
          hasArt = hero.startsWith('/generated/');
          cover = hasArt ? hero : '';
          line = data && (data.definingLine || data.content)
            ? String(data.definingLine || data.content).slice(0, 60)
            : '';
          dynasty = data && typeof data.dynasty === 'string' ? data.dynasty : '';
          dynasty = normDynasty(dynasty, data?.author || p.author || '');
        }
      } catch (e) {
        // keep defaults
      }
      return { ...p, hasArt, cover, line, dynasty };
    });
    res.json({ poems });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/generated/:id', (req, res) => {
  try {
    const file = path.join(GENERATED_DIR, `${req.params.id}.json`);
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'not found' });
    res.json(JSON.parse(fs.readFileSync(file, 'utf-8')));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/generate/:id', async (req, res) => {
  try {
    const { poet, title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'title and content required' });
    }
    const { spawn } = await import('child_process');
    const child = spawn(
      'node',
      [
        path.join(__dirname, 'scripts', 'generate-poem.js'),
        req.params.id,
        poet || '未知诗人',
        title,
        content,
      ],
      { env: process.env }
    );

    let output = '';
    let errOutput = '';
    child.stdout.on('data', (d) => { output += d; });
    child.stderr.on('data', (d) => { errOutput += d; });

    child.on('close', (code) => {
      if (code !== 0) return res.status(500).json({ error: errOutput || 'generation failed' });
      const file = path.join(GENERATED_DIR, `${req.params.id}.json`);
      res.json(JSON.parse(fs.readFileSync(file, 'utf-8')));
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── AI 沉浸页完整流水线（异步任务） ──────────────────────────────
const TASK_DIR = path.join(__dirname, 'data', 'tasks');

function readTask(taskId) {
  const f = path.join(TASK_DIR, `${taskId}.json`);
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, 'utf-8'));
}

app.post('/api/generate-ai/:id', async (req, res) => {
  try {
    const rawId = req.params.id;
    const voice = req.body?.voice || 'edge-yunjian';
    const existing = readTask(rawId);
    if (existing && existing.status === 'running') {
      return res.json({ success: true, taskId: rawId, status: 'running' });
    }
    fs.mkdirSync(TASK_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(TASK_DIR, `${rawId}.json`),
      JSON.stringify({ status: 'running', stage: 'queued', progress: 0, detail: '排队中…', generatedId: rawId })
    );
    const { spawn } = await import('child_process');
    const child = spawn(
      'node',
      [path.join(__dirname, 'scripts', 'generate-ai.mjs'), rawId, '--voice', voice, '--task', rawId],
      { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let log = '';
    child.stdout.on('data', (d) => { log += d; });
    child.stderr.on('data', (d) => { log += d; });
    child.on('error', (e) => {
      const cur = readTask(rawId) || {};
      fs.writeFileSync(path.join(TASK_DIR, `${rawId}.json`), JSON.stringify({ ...cur, status: 'error', stage: 'spawn-fail', error: String(e) }, null, 2));
    });
    child.on('exit', (code) => {
      const cur = readTask(rawId);
      if (code !== 0 && cur && cur.status !== 'done' && cur.status !== 'error') {
        fs.writeFileSync(path.join(TASK_DIR, `${rawId}.json`), JSON.stringify({ ...cur, status: 'error', stage: 'exit', error: `任务异常退出 (code ${code})，日志：${log.slice(-500)}` }, null, 2));
      }
    });
    res.json({ success: true, taskId: rawId, status: 'running' });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/generate-ai/:id', (req, res) => {
  try {
    const t = readTask(req.params.id);
    if (!t) return res.status(404).json({ error: 'no such task' });
    res.json(t);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// 静态与 SPA fallback
// 产物资源（generated/audio/videos）由 public 直接静态服务；dist 承载构建产物与 SPA fallback
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3300;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Poetry Realm server running on http://0.0.0.0:${PORT}`);
});