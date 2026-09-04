#!/bin/bash
# Node.js 20 LTS 一键安装（参考 cloud-his-web/spec-kit/install-nodejs.sh 风格）
# 支持 Ubuntu/Debian / CentOS/RHEL/Rocky/AlmaLinux / OpenCloudOS / 通用 Linux 二进制
# 用法: sudo bash install-nodejs.sh   （非 root 自动提权提示）
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

[ "$(id -u)" = "0" ] || { echo -e "${RED}请以 root 运行：sudo bash $0${NC}"; exit 1; }

echo "==========================================="
echo "  Node.js 20 LTS Installer (poetry deploy)"
echo "==========================================="

if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo -e "${RED}❌ 无法识别系统 (无 /etc/os-release)${NC}"; exit 1
fi
echo -e "${YELLOW}Detected OS: $OS${NC}"

# 已安装且版本 >= 20 则跳过
if command -v node >/dev/null 2>&1 && [ "$(node -v | sed 's/v//' | cut -d. -f1)" -ge 20 ]; then
    echo -e "${GREEN}✅ Node $(node -v) 已满足 (>=20)，无需安装${NC}"; exit 0
fi

case "$OS" in
  ubuntu|debian)
    echo -e "${YELLOW}→ 通过 NodeSource 安装 Node 20${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs build-essential
    ;;
  centos|rhel|rocky|almalinux|opencloudos|fedora)
    if command -v dnf >/dev/null 2>&1; then PKG=dnf; else PKG=yum; fi
    echo -e "${YELLOW}→ 通过 NodeSource (rpm) 安装 Node 20${NC}"
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    $PKG install -y nodejs gcc-c++ make
    ;;
  *)
    # 通用：官方预编译二进制 → /usr/local
    ARCH="$(uname -m)"
    case "$ARCH" in x86_64) ARCH=x64;; aarch64|arm64) ARCH=arm64;; *) echo "${RED}不支持的架构 $ARCH${NC}"; exit 1;; esac
    echo -e "${YELLOW}→ 官方二进制安装 (linux-$ARCH) → /usr/local${NC}"
    VER=v20.18.1
    curl -fsSL "https://nodejs.org/dist/${VER}/node-${VER}-linux-${ARCH}.tar.xz" -o /tmp/node.tar.xz
    tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1
    rm -f /tmp/node.tar.xz
    ;;
esac

hash -r
echo -e "${GREEN}✅ Node $(node -v) / npm $(npm -v) 安装完成${NC}"
