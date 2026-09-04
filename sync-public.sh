#!/usr/bin/env bash
# ============================================================================
# 诗境产物双向同步：工作区 ↔ 产物仓镜像（poetry-public，git-lfs）
#
# 用法:
#   bash sync-public.sh push            # 默认：工作区 → 镜像 → git add（等提交/推送）
#   bash sync-public.sh pull            # 镜像 → 工作区（覆盖同名产物，保留工作区多余文件）
#   bash sync-public.sh pull --remote   # 先 git pull 远端更新镜像，再回灌工作区
#
# 说明:
#   - 产物仓镜像目录是 GitHub toff314/poetry-public 的本地 clone，
#     由它负责与远端同步（push/pull 到 GitHub）。
#   - 覆盖策略：
#       push 使用镜像对齐（--delete，被排除的运行时文件不受影响）；
#       pull 不使用 --delete，避免误删工作区里尚未推送的新产物（同名文件以镜像为准覆盖）。
#   - 运行时状态文件（data/tasks、data/videos、danmaku.db）两方向都排除，不随仓库流转。
#   - 可用环境变量覆盖默认路径：
#       SRC_WORKSPACE=/path/to/poetry
#       POETRY_PUBLIC_DIR=/path/to/poetry-public
# ============================================================================
set -euo pipefail

ACTION="${1:-push}"
[ "$ACTION" = "push" ] || [ "$ACTION" = "pull" ] || { echo "参数须为 push 或 pull"; exit 1; }
PULL_REMOTE=0
for a in "$@"; do [ "$a" = "--remote" ] && PULL_REMOTE=1; done

# 默认同级布局推导：poetry(代码仓·工作区) 与 poetry-public(产物仓镜像) 同级
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT="$(dirname "$SCRIPT_DIR")"
WS="${SRC_WORKSPACE:-$PARENT/poetry}"
MIRROR="${POETRY_PUBLIC_DIR:-$PARENT/poetry-public}"

[ -d "$WS/web-system" ]      || { echo "工作区不存在: $WS"; exit 1; }
[ -d "$MIRROR/web-system" ]  || { echo "产物仓镜像不存在: $MIRROR（请先 git clone toff314/poetry-public）"; exit 1; }

# 双向排除：运行时状态（不入仓）
DATA_EXCLUDES=(--exclude 'tasks' --exclude 'videos' --exclude 'danmaku.db')

sync_push() {
  echo "→ [push] 工作区 $WS → 镜像 $MIRROR"
  rsync -a "$WS/cover.jpeg" "$MIRROR/cover.jpeg"
  rsync -a "${DATA_EXCLUDES[@]}" "$WS/web-system/data/" "$MIRROR/web-system/data/"
  rsync -a "$WS/web-system/public/generated" "$MIRROR/web-system/public/"
  rsync -a "$WS/web-system/public/avatars" "$MIRROR/web-system/public/"
  rsync -a "$WS/web-system/public/audio" "$MIRROR/web-system/public/"
  rsync -a "$WS/web-system/public/videos" "$MIRROR/web-system/public/" 2>/dev/null || true
  (cd "$MIRROR" && git add -A) || echo "（提示：镜像尚未纳入 git，跳过 git add）"
  echo "完成：已同步并 git add。请走提交/推送流程（远端目标 toff314/poetry-public）"
}

sync_pull() {
  if [ "$PULL_REMOTE" = "1" ]; then
    echo "→ [pull] 先更新镜像（git pull --ff-only origin main）"
    (cd "$MIRROR" && git pull --ff-only origin main) || { echo "git pull 失败（网络/凭据/本地未提交），中止"; exit 1; }
  fi
  echo "→ [pull] 镜像 $MIRROR → 工作区 $WS（覆盖同名产物，保留多余文件）"
  rsync -a "$MIRROR/cover.jpeg" "$WS/cover.jpeg" 2>/dev/null || true
  rsync -a "${DATA_EXCLUDES[@]}" "$MIRROR/web-system/data/" "$WS/web-system/data/"
  rsync -a "$MIRROR/web-system/public/generated/" "$WS/web-system/public/generated/" 2>/dev/null || true
  rsync -a "$MIRROR/web-system/public/avatars/" "$WS/web-system/public/avatars/" 2>/dev/null || true
  rsync -a "$MIRROR/web-system/public/audio/" "$WS/web-system/public/audio/" 2>/dev/null || true
  rsync -a "$MIRROR/web-system/public/videos/" "$WS/web-system/public/videos/" 2>/dev/null || true
  echo "完成：产物已回灌工作区。提示：pull 不删除工作区多余文件，如需清理由你手动确认。"
}

case "$ACTION" in
  push) sync_push ;;
  pull) sync_pull ;;
esac
