#!/bin/bash
# retry-pending-poems.sh — 风控冷却后的温和补跑
# 策略：先静默 40 分钟降风险分 → 每 30 分钟只跑 1 首（DAILY_GEN_COUNT=1）→ 前 2 首 done 即退出
LOG=/home/yuanwu/poetry/web-system/data/retry-poems.log
DB=/home/yuanwu/poetry/web-system/data/ranking.db
cd /home/yuanwu/poetry/web-system

echo "[$(date '+%F %T')] 风控温和重试：静默 40 分钟后开始，每 30 分钟 1 首，最多 8 轮" >> "$LOG"
sleep 2400

for i in $(seq 1 8); do
  front2=$(sqlite3 "$DB" "SELECT count(*) FROM (SELECT 1 FROM ranking WHERE status='pending' AND attempts<3 ORDER BY rank LIMIT 2);")
  if [ "$front2" -eq 0 ]; then
    echo "[$(date '+%F %T')] 队列前 2 首已无 pending，退出" >> "$LOG"
    exit 0
  fi
  echo "[$(date '+%F %T')] 第 ${i}/8 轮（1 首）" >> "$LOG"
  DAILY_GEN_COUNT=1 node scripts/daily-gen.mjs >> "$LOG" 2>&1
  sleep 1800
done

echo "[$(date '+%F %T')] 轮数耗尽，退出" >> "$LOG"
