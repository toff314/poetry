# 仓库说明（poetry）

本仓库为 **代码仓库**：诗境 Poetry Realm（沉浸式诗词 Web）前端/后端/技能/脚本全部源码与配置。

## 仓库结构
| 仓库 | 内容 |
|---|---|
| `toff314/poetry`（本仓） | 代码：`web-system/src`、`server.js`、`scripts/`、构建配置、`skills/` |
| `toff314/poetry-public` | 产物（git-lfs）：`poetry.db`、生成图 `public/generated`、音频 `public/audio`、注解/生成 JSON、封面 |

## 本地运行
```bash
# 1. 克隆两个仓库到同一目录层级（poetry-public 需开启 git-lfs）
git clone https://github.com/toff314/poetry.git
git clone https://github.com/toff314/poetry-public.git

# 2. 把产物铺回代码仓库对应路径（或建立符号链接）
ln -s ../poetry-public/web-system/data web-system/data
ln -s ../poetry-public/web-system/public web-system/public

# 3. 配置 .env（ARK/腾讯 TTS 等）后启动
cd web-system && npm install && npm run dev
```

## 产物同步（双向）
`sync-public.sh`（与 poetry-public 同级布置）负责工作区 ↔ 产物仓镜像的双向同步（运行时状态不入仓）：

```bash
bash sync-public.sh push              # 工作区 → 镜像 → git add（随后走提交/推送）
bash sync-public.sh pull              # 镜像 → 工作区（覆盖同名产物，保留多余文件）
bash sync-public.sh pull --remote     # 先 git pull 远端，再回灌工作区
```

新增资源（AI 生图 / 音频 / 视频 mp4 / 更新数据库）后执行 `push`；换机器或恢复资源时执行 `pull [--remote]`。
默认要求两目录同级：`poetry` / `poetry-public`；可用环境变量 `SRC_WORKSPACE`、`POETRY_PUBLIC_DIR` 覆盖路径。

## 生产部署
参见 [DEPLOYMENT.md](DEPLOYMENT.md)：`sudo bash deploy/deploy.sh serve` 一步部署
（铺产物仓 → 构建 → systemd 服务），nginx/域名/TLS 由外部 ops 管理。
