#!/usr/bin/env bash
# 批量生成剩余 Suno BGM：逐提示词独立进程 + 清场，失败重试。用法: batch-suno-bgm.sh <tsv文件>
# TSV 每行: <title>\t<tags>
set -u
LIST="${1:?须指定 tsv 清单}"
LOG="${2:-/home/yuanwu/poetry/web-system/logs/suno-bgm-batch.log}"
DONE="${LOG%.log}-done.txt"
GEN="scripts/suno-bgm-gen.py"
export SUNO_MODEL="${SUNO_MODEL:-chirp-goose}"
mkdir -p "$(dirname "$LOG")"; touch "$DONE"

clean9255() {
  for p in $(ss -tlnp 2>/dev/null | grep 9255 | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$p" 2>/dev/null; done
  sleep 1
}

while IFS=$'\t' read -r title tags; do
  [ -z "$title" ] && continue
  grep -qxF "$title" "$DONE" && continue
  ok=0
  for attempt in 1 2 3; do
    clean9255
    echo "[$(date +%H:%M:%S)] GEN $title (attempt $attempt)" >> "$LOG"
    if (cd /home/yuanwu/poetry/web-system && timeout 900 python3 -u "$GEN" "$title" "$tags") >> "$LOG" 2>&1; then
      echo "$title" >> "$DONE"
      echo "[$(date +%H:%M:%S)] OK $title" >> "$LOG"
      ok=1
      break
    fi
    echo "[$(date +%H:%M:%S)] ERR $title attempt $attempt" >> "$LOG"
    sleep 20
  done
  [ "$ok" = 0 ] && echo "[$(date +%H:%M:%S)] GIVEUP $title" >> "$LOG"
done < "$LIST"
clean9255
echo "[$(date +%H:%M:%S)] ALL DONE" >> "$LOG"
