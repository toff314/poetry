#!/bin/bash
# ============================================================================
# 诗境 Poetry Realm · 生产部署脚本（参照 zhihu-wiki/deploy/deploy.sh 模式）
#
# 用法:
#   sudo bash deploy/deploy.sh <command>
#
# 命令:
#   prepare        拉取/铺产物仓(git-lfs) + 生成 .env(模板) + npm ci
#   build          npm ci + vite 生产构建 (web-system/dist)
#   start          (缺 dist 则 build) + 安装 systemd 服务 + 启动 + 健康检查
#   stop           停止 systemd 服务
#   restart        仅重启服务（代码已更新时）
#   status         服务与端口状态
#   logs [n]       journalctl 最近 n 行（默认 50）
#   serve          prepare + build + start（全量部署）
#   umami [up|down|status]  本地访问统计 Umami（docker compose，可选）
#   help           用法说明
#
# 前置: Node >= 20（缺省可先跑 deploy/install-nodejs.sh）；root 权限装 systemd 服务
# 依赖: 产物仓 toff314/poetry-public（git-lfs）需可访问：默认 clone 到本仓同级，
#       或用环境变量 POETRY_PUBLIC_DIR 指定目录
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$ROOT/web-system"
PUB_DIR="${POETRY_PUBLIC_DIR:-$ROOT/../poetry-public}"
SERVICE_NAME="poetry"
SERVICE_UNIT="/etc/systemd/system/${SERVICE_NAME}.service"
SERVICE_TEMPLATE="$ROOT/deploy/${SERVICE_NAME}.service"
PORT="${PORT:-3300}"
NODE_BIN="$(command -v node || echo /usr/bin/node)"

log()  { echo -e "\033[0;32m==> $*\033[0m"; }
warn() { echo -e "\033[1;33m!!  $*\033[0m"; }
err()  { echo -e "\033[0;31m✗  $*\033[0m" >&2; }

# ---------- 产物仓（git-lfs）铺取 ----------
sync_assets() {
  local need_pull=0
  if [ ! -d "$PUB_DIR/web-system" ]; then
    if [ -n "${POETRY_PUBLIC_DIR:-}" ] || [ -d "$ROOT/../poetry-public/.git" ]; then
      : # 路径存在则继续（下方报错）
    else
      warn "产物仓不存在: $PUB_DIR"
      log "开始 clone toff314/poetry-public (git-lfs) ..."
      git lfs version >/dev/null 2>&1 || { err "缺少 git-lfs，请先安装：git lfs install / apt install git-lfs"; exit 1; }
      git clone https://github.com/toff314/poetry-public.git "$PUB_DIR"
      need_pull=1
    fi
  fi
  [ -d "$PUB_DIR/web-system" ] || { err "产物仓目录无效: $PUB_DIR（可用 POETRY_PUBLIC_DIR 指定）"; exit 1; }
  [ "$need_pull" = "0" ] && (cd "$PUB_DIR" && git pull --ff-only origin main 2>/dev/null || warn "产物仓 git pull 失败（忽略，继续用本地）")

  log "铺取产物 → $WEB_DIR （data / public / cover）"
  mkdir -p "$WEB_DIR/data" "$WEB_DIR/public"
  rsync -a "$PUB_DIR/cover.jpeg" "$ROOT/cover.jpeg" 2>/dev/null || true
  rsync -a --exclude tasks --exclude videos --exclude danmaku.db \
        "$PUB_DIR/web-system/data/" "$WEB_DIR/data/"
  rsync -a "$PUB_DIR/web-system/public/generated/" "$WEB_DIR/public/generated/" 2>/dev/null || true
  rsync -a "$PUB_DIR/web-system/public/audio/" "$WEB_DIR/public/audio/" 2>/dev/null || true
  rsync -a "$PUB_DIR/web-system/public/videos/" "$WEB_DIR/public/videos/" 2>/dev/null || true
}

# ---------- .env ----------
ensure_env() {
  if [ ! -f "$WEB_DIR/.env" ]; then
    [ -f "$WEB_DIR/.env.example" ] || { err "缺少 .env.example"; exit 1; }
    cp "$WEB_DIR/.env.example" "$WEB_DIR/.env"
    chmod 600 "$WEB_DIR/.env"
    warn "已生成 $WEB_DIR/.env（模板）。请编辑填入：ARK_API_KEY / PUBLIC_ASSET_BASE / 腾讯 TTS 密钥后重跑"
  fi
}

web_build() {
  log "构建 web-system（npm ci + vite build）…"
  cd "$WEB_DIR"
  npm ci --no-audit --no-fund
  npm run build
  cd "$ROOT"
}

# ---------- systemd ----------
service_install() {
  log "安装 systemd 服务 $SERVICE_NAME"
  sed -e "s|__WEB_DIR__|$WEB_DIR|g" -e "s|__NODE_BIN__|$NODE_BIN|g" \
      "$SERVICE_TEMPLATE" > "$SERVICE_UNIT"
  systemctl daemon-reload
}

health_check() {
  sleep 3
  if ! systemctl is-active --quiet "$SERVICE_NAME"; then
    err "$SERVICE_NAME 启动失败！最近日志："
    journalctl -u "$SERVICE_NAME" --no-pager -n 20
    exit 1
  fi
  if ! curl -fsS -m 5 "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
    warn "服务 active 但 /api/health 未响应（端口 $PORT）"
  else
    log "✅ $SERVICE_NAME 运行中 → http://127.0.0.1:$PORT"
  fi
}

case "${1:-help}" in
  prepare)
    sync_assets
    ensure_env
    log "产物已就位。下一步：sudo bash deploy/deploy.sh build && sudo bash deploy/deploy.sh start"
    ;;
  build) web_build ;;
  start)
    [ -f "$WEB_DIR/dist/index.html" ] || web_build
    sync_assets
    ensure_env
    service_install
    systemctl enable "$SERVICE_NAME" 2>/dev/null || true
    systemctl restart "$SERVICE_NAME"
    health_check
    ;;
  stop)
    systemctl stop "$SERVICE_NAME" 2>/dev/null || true
    log "$SERVICE_NAME 已停止"
    ;;
  restart)
    [ -f "$SERVICE_UNIT" ] || service_install
    systemctl restart "$SERVICE_NAME"
    health_check
    ;;
  status)
    echo "--- $SERVICE_NAME ---"
    systemctl status "$SERVICE_NAME" 2>/dev/null | grep -E "Loaded|Active|Main PID" || echo "服务未安装/未运行"
    echo "--- 端口 $PORT ---"
    ss -tlnp 2>/dev/null | grep ":$PORT " || echo "端口 $PORT 未监听"
    ;;
  logs)
    systemctl status "$SERVICE_NAME" >/dev/null 2>&1 && journalctl -u "$SERVICE_NAME" --no-pager -n "${2:-50}" || warn "服务未运行，无日志"
    ;;
  serve)
    sync_assets
    ensure_env
    web_build
    service_install
    systemctl enable "$SERVICE_NAME" 2>/dev/null || true
    systemctl restart "$SERVICE_NAME"
    health_check
    echo "============================================"
    echo "  诗境 Poetry Realm → http://127.0.0.1:$PORT"
    echo "  nginx / 域名 / TLS 建议由外部 ops 管理（见 deploy/nginx 示例）"
    echo "  Umami 统计：sudo bash deploy/deploy.sh umami up"
    echo "============================================"
    ;;
  umami)
    UMI=/root/umami/docker-compose.yml
    case "${2:-status}" in
      up)     [ -f "$UMI" ] && docker compose -f "$UMI" up -d || { err "缺少 $UMI"; exit 1; }; log "Umami → http://localhost:8765" ;;
      down)   [ -f "$UMI" ] && docker compose -f "$UMI" down || true ;;
      status) [ -f "$UMI" ] && docker compose -f "$UMI" ps || echo "Umami 未配置（$UMI）" ;;
    esac
    ;;
  help|--help|-h)
    sed -n '2,22p' "${BASH_SOURCE[0]}" | sed 's/^#//; s/^ //'
    ;;
  *)
    err "未知命令: $1（$0 help 查看用法）"; exit 1 ;;
esac
