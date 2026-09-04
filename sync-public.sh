#!/usr/bin/env bash
# 将工作区（immersive-poetry-page/web-system）新增产物增量同步到 poetry-public 并暂存
set -e
SRC="${1:-/home/yuanwu/immersive-poetry-page}"
DST=/home/yuanwu/poetry-public
[ -d "$SRC/web-system" ] || { echo "源目录不存在: $SRC"; exit 1; }
rsync -a "$SRC/cover.jpeg" "$DST/cover.jpeg"
rsync -a --exclude 'tasks' --exclude 'videos' --exclude 'danmaku.db' "$SRC/web-system/data/" "$DST/web-system/data/"
rsync -a "$SRC/web-system/public/generated" "$DST/web-system/public/"
rsync -a "$SRC/web-system/public/audio" "$DST/web-system/public/"
rsync -a "$SRC/web-system/public/videos" "$DST/web-system/public/" 2>/dev/null || true
cd "$DST"
git add -A 2>/dev/null || echo "（poetry-public 尚未 git init，先完成 init）"
echo "已同步 → $DST，git 暂存完成，等待提交/推送"
