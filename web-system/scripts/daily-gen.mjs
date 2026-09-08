#!/usr/bin/env node
/**
 * daily-gen.mjs — 每日自动按「经典三百首榜单」生成沉浸页（crontab 03:30 调用，每日 2 首）。
 *
 * 流程：ranking.db 取 status=pending 且 attempts<3 的前 2 条（按 rank=知名度序）
 *   → 逐首 spawn 完整流水线（generate-ai.mjs，无注解自动走 opencode 分镜）
 *   → 成功置 done；失败 attempts+1（≥3 跳过，避免坏条目卡死队列）；日志输出 stdout。
 *
 * 用法: node scripts/daily-gen.mjs [--dry]     # --dry 只打印将生成条目
 */
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..'); // web-system
const DAILY = Number(process.env.DAILY_GEN_COUNT || 2);
const DRY = process.argv.includes('--dry');
const NODE = process.execPath;
const GEN = path.join(ROOT, 'scripts', 'generate-ai.mjs');
const DB_PATH = path.join(ROOT, 'data', 'ranking.db');

function log(m) { console.log(`[${new Date().toISOString().slice(0, 19)}] ${m}`); }

let db;
try { db = new DatabaseSync(DB_PATH); } catch (e) { log('打开 ranking.db 失败: ' + e.message); process.exit(1); }

const rows = db.prepare(
  "SELECT rank, db_id, title, author FROM ranking WHERE status='pending' AND attempts < 3 ORDER BY rank LIMIT ?"
).all(DAILY);

if (!rows.length) { log('队列为空（全部 done/skipped），今日无事'); process.exit(0); }

for (const r of rows) {
  log(`#${r.rank} 《${r.title}》· ${r.author} (db_id=${r.db_id})`);
  if (DRY) continue;
  const t0 = Date.now();
  const rs = spawnSync(NODE, [GEN, String(r.db_id), '--voice', 'edge-yunjian', '--task', String(r.db_id)], {
    encoding: 'utf-8', timeout: 55 * 60 * 1000, cwd: ROOT,
  });
  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  if (rs.status === 0) {
    db.prepare("UPDATE ranking SET status='done' WHERE rank=?").run(r.rank);
    log(`✓ #${r.rank} 生成完成（${mins}min），已标记 done`);
  } else {
    db.prepare("UPDATE ranking SET attempts = attempts + 1 WHERE rank=?").run(r.rank);
    const a = db.prepare('SELECT attempts FROM ranking WHERE rank=?').get(r.rank)?.attempts || 0;
    const err = (rs.stderr || rs.stdout || '').slice(-400).replace(/\n/g, ' ');
    log(`✗ #${r.rank} 生成失败（${mins}min）attempts=${a}${a >= 3 ? '（≥3 次，标记跳过）' : ''} :: ${err}`);
    if (a >= 3) db.prepare("UPDATE ranking SET status='skipped' WHERE rank=?").run(r.rank);
  }
}
db.close();
log(DRY ? 'dry-run 结束' : '本次 cron 结束');
