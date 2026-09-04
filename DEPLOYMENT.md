# 诗境 Poetry Realm · 部署文档

> 部署模式参考 zhihu-wiki（deploy/deploy.sh + systemd + 外部 nginx）。

## 组件与仓库

| 组件 | 仓库 | 说明 |
|---|---|---|
| 应用代码 | `toff314/poetry` | React(Vite) + Express + SQLite；`web-system` 前后端一体 |
| 产物资源 | `toff314/poetry-public` | **git-lfs**：poetry.db、生成图、朗诵音频、注解/生成 JSON、封面 |

两个仓库分工：代码仓不含 `node_modules/dist/data/public/.env`；产物仓只含资源。
部署 = 代码仓 clone + 产物仓(lfs) clone + 铺资源 + 构建 + systemd 服务。

## 环境要求

- Linux（Ubuntu/Debian/CentOS/Rocky 等），**root**
- Node.js ≥ 20（`deploy/install-nodejs.sh` 一键安装）
- git + git-lfs（`git lfs install`）
- rsync
- （可选）Docker 用于 Umami 本地统计
- 出公网视频需要：火山方舟 API Key、图片公网基址（见 .env）

## 快速开始（全量部署）

```bash
# 1. 安装依赖（如缺）
sudo bash deploy/install-nodejs.sh

# 2. 克隆（建议与产物仓同级，便于默认路径）
git clone https://github.com/toff314/poetry.git
cd poetry
# 产物仓默认 clone 到 ../poetry-public（脚本自动处理），或用：
# export POETRY_PUBLIC_DIR=/data/poetry-public

# 3. 一步部署：铺产物 + 生成 .env + 构建 + systemd 启动
sudo bash deploy/deploy.sh serve
# 首次 .env 由模板生成，编辑填入密钥后重新:
sudo bash deploy/deploy.sh restart
```

## 常用运维

```bash
sudo bash deploy/deploy.sh build     # 仅重新构建（代码更新后）
sudo bash deploy/deploy.sh start     # 安装/重启服务 + 健康检查
sudo bash deploy/deploy.sh restart   # 仅重启（.env 变更后）
sudo bash deploy/deploy.sh status    # 服务与端口状态
sudo bash deploy/deploy.sh logs 100  # 最近日志
sudo bash deploy/deploy.sh umami up  # （可选）本地访问统计 Umami → localhost:8765
```

服务详情：`systemctl status poetry`；日志：`journalctl -u poetry -f`。

## 环境变量（web-system/.env）

见 [web-system/.env.example](web-system/.env.example)。关键项：

| 变量 | 作用 |
|---|---|
| `ARK_API_KEY` | 火山方舟 Key（AI 视频生成） |
| `PUBLIC_ASSET_BASE` | 图片公网基址（生成视频时火山需拉图） |
| `TENCENT_*` | 腾讯云语音（可选） |
| `UMAMI_URL` | 本地统计转发目标（可选） |

## 域名 / TLS / nginx

本站 nginx 建议由外部 ops 管理（参考 askfount-ops 模式）。
接入示例见 [deploy/nginx/poetry.conf.example](deploy/nginx/poetry.conf.example)：
反代 `127.0.0.1:3300`，生成资源路径加长缓存，`client_max_body_size 500M`。

## 升级流程

```bash
cd <poetry> && git pull                     # 拉代码
bash sync-public.sh pull --remote           # 产物仓拉远端并回灌工作区（含新增视频/图）
sudo bash deploy/deploy.sh build            # 重新构建
sudo bash deploy/deploy.sh restart          # 重启生效
```

新增产物（AI 生图/音频/视频）后需推产物仓：

```bash
bash sync-public.sh push                    # 工作区 → poetry-public 镜像 + git add
cd ../poetry-public && git commit … && git push   # 推 GitHub
```

## 排障

- 端口占用：`sudo ss -tlnp | grep 3300`
- API 不通但服务 active：`curl http://127.0.0.1:3300/api/health`
- 启动失败：`sudo journalctl -u poetry -n 50`
- 产物缺失（白图/无数据）：重跑 `deploy.sh prepare`
- 视频任务报"未配置 PUBLIC_ASSET_BASE"：填写可公网访问的资源基址后 restart
