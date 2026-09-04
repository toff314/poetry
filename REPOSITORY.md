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

## 产物同步
新增资源（AI 生图 / 音频 / 视频 mp4 / 更新数据库）后：
```bash
bash scripts/sync-public.sh     # 将产物增量同步进 ../poetry-public 并提示推送
```
