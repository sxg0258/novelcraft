# NovelCraft — 小说写作工具

> 一个跑在 Docker 里的小说创作工具，专为家庭 NAS（飞牛 fnOS）优化，也兼容通用 Linux 环境。

## 🚀 5 分钟上手（推荐：GHCR 镜像路线）

### 飞牛 NAS 用户（最快路径）

1. **把代码推到 GitHub**（[GitHub Desktop](https://desktop.github.com/) 一键搞定）
2. **GitHub Actions 自动构建镜像**到 `ghcr.io/<你的用户名>/novelcraft-{backend,frontend}:latest`
3. **SSH 进飞牛跑一行命令**：

```bash
curl -L https://raw.githubusercontent.com/<你的用户名>/novelcraft/main/deploy/deploy.sh -o /tmp/deploy.sh
GHCR_USER=<你的github用户名> bash /tmp/deploy.sh
```

4. 浏览器访问 `http://飞牛IP:5210`，注册第一个账号（自动管理员）

**完整教程**：[`docs/DEPLOY.md`](docs/DEPLOY.md)

### 通用 Linux 用户

```bash
git clone https://github.com/<owner>/novelcraft.git && cd novelcraft
echo "DB_PASSWORD=YourStrongPass
JWT_SECRET=$(openssl rand -hex 32)
DATA_PATH=./data" > .env
docker compose up -d
# 访问 http://localhost:5210
```

完整功能说明见下方 ↓

---

## 🎯 特性

- ✍️ **专注写作**：Tiptap 富文本编辑器，1.5 秒防抖自动保存，所见即所得
- 🎯 **专注模式**：全屏沉浸 + 25 分钟番茄钟 + 雨声/炉火/白噪（Web Audio 生成，零资源依赖）
- 📊 **字数热力图**：GitHub 风格，180 天写作足迹
- 📚 **结构化管理**：卷/章/节树形结构
- 👥 **角色卡**：基本信息 + 关系网 + 头像
- 🌍 **设定卡**：地点 / 物品 / 势力 / 技能 / 其他，灵活分类
- 🧩 **完全自定义字段**：给任意卡片加文本/数字/枚举/日期/URL 字段，不预设小说方向
- 🗂 **大纲视图**：树形结构，自由层级，鼠标点选编辑
- 📈 **写作统计**：章节数、总字数、平均字数、最近更新
- 📤 **多格式导出**：整本 Markdown / TXT / **docx** / **PDF 打印版**，单章节 Markdown
- 🤖 **AI 全套接入**：OpenAI/Claude/DeepSeek/通义/智谱/Ollama/自定义，**统一网关 + 流式 SSE + 自动 fallback**
- 🎨 **AI 风格库**：用户自建多套 prompt 风格，支持温度/top_p/惩罚参数
- 💬 **AI 续写/润色/扩写/缩写/对话**：5 种模式，按 `Ctrl+J` 唤起
- 🔍 **全文搜索**：PostgreSQL FTS，`Ctrl+K` 唤起，支持中英文 + 章节正文
- 📜 **版本历史**：每 10 分钟自动快照，最多保留 20 版，**可对比 diff + 一键回滚**
- 👥 **多用户认证**：JWT + scrypt 密码哈希，首个注册用户自动管理员
- 💾 **JSON 备份/恢复**：导出/导入全量数据，可跨机器迁移
- 📱 **PWA 支持**：可装到桌面 / 手机主屏，离线可用
- 💾 **本地优先**：数据全在你的硬盘上
- 🪶 **NAS 友好**：x86/arm64 双架构，空闲约 500MB 内存

## 🏗️ 技术栈

- **前端**：Vue 3 + Vite + Tiptap 2 + Pinia
- **后端**：Fastify + Prisma + Node.js 20
- **数据库**：PostgreSQL 15 + Redis 7
- **容器**：docker compose，单文件部署

## 📁 目录结构

```
novelcraft/
├── docker-compose.yml          # 一键编排（端口 5210）
├── .env.example                # 环境变量
├── docs/
│   └── DESIGN.md               # 完整方案设计 v1.1
├── deploy/
│   └── README.md               # 飞牛 NAS 部署说明
├── backend/                    # Fastify 后端
│   ├── Dockerfile              # multi-stage, <200MB
│   ├── package.json
│   ├── prisma/schema.prisma    # 13 张表（含 AI Provider + AI Chat）
│   └── src/
│       ├── server.js           # 入口 + 书/章节 CRUD
│       ├── db.js               # Prisma 单例
│       ├── snapshots.js        # 每日字数快照
│       ├── utils.js            # 工具函数
│       ├── ai/
│       │   ├── gateway.js      # 统一 AI 网关（流式 + 多 provider）
│       │   └── templates.js    # 预置 prompt 模板
│       └── routes/
│           ├── characters.js   # 角色 API
│           ├── world-items.js  # 设定 API
│           ├── custom-fields.js # 自定义字段 API
│           ├── outlines.js     # 大纲 API
│           ├── ai-styles.js    # AI 风格 API
│           ├── ai.js           # AI Provider + 续写/润色/对话 API
│           └── export.js       # 导出 + 统计 + 热力图 API
└── frontend/                   # Vue 3 前端
    ├── Dockerfile              # multi-stage, <30MB
    ├── nginx.conf              # 静态托管 + API 反代
    └── src/
        ├── App.vue             # 主框架（5 个标签页 + Ctrl+J 全局快捷键）
        ├── style.css
        └── components/
            ├── ChapterEditor.vue   # 编辑器（写作 + 热力图 + 专注入口）
            ├── CharacterPanel.vue  # 角色管理
            ├── WorldPanel.vue      # 设定管理（卡片网格）
            ├── OutlinePanel.vue    # 大纲（树形）
            ├── ExportPanel.vue     # 导出与备份（md/txt/docx/pdf）
            ├── Heatmap.vue         # 字数热力图
            ├── FocusMode.vue       # 专注模式（全屏 + 番茄钟 + 白噪）
            ├── AISettings.vue      # AI 设置（Provider 管理 + 风格管理）
            ├── AIStyleManager.vue  # 风格管理子组件
            └── AIAssistant.vue     # AI 助手侧边栏（续写/润色/扩写/缩写/对话）
```

## 🚀 快速开始

### 飞牛 NAS 用户

```bash
# 1. SSH 进飞牛
ssh admin@你的飞牛IP
sudo -i

# 2. 创建项目目录
mkdir -p /vol1/1000/docker/novelcraft/data/{postgres,redis,files}
cd /vol1/1000/docker/novelcraft

# 3. 上传项目文件（或 git clone）

# 4. 启动
docker compose up -d

# 5. 浏览器访问
# http://你的飞牛IP:5210
```

详细步骤见 [`docs/DESIGN.md`](docs/DESIGN.md) 第 4 章。

### 通用 Linux

```bash
# 改 .env 里的 DATA_PATH 为本地目录
DATA_PATH=./data

docker compose up -d
# 访问 http://localhost:5210
```

### 启用本地 AI（可选，M3 完整功能）

```bash
docker compose --profile ai-local up -d ollama
docker exec -it novelcraft-ollama ollama pull qwen2.5:7b
```

## 🛣️ 路线图

- [x] **M0**：项目骨架 + docker 编排 + 文档
- [x] **M1**：书/章节 CRUD + 编辑器 + 自动保存 + 角色卡 + 设定卡 + 大纲 + 导出 + 统计 + AI 风格库
- [x] **M2**：docx 导出 + PDF 打印版 + 专注模式 + 字数热力图
- [x] **M3**：统一 AI 网关 + 流式 SSE + Provider 管理 + 风格管理 + 5 种 AI 交互 + `Ctrl+J`
- [x] **M4**：全文搜索 + 版本历史 + diff/回滚 + 多用户认证 + JSON 备份/恢复 + PWA

## 📝 当前能力清单（M1 已完成）

### 创作
- ✅ 新建/编辑/删除书（标题、简介、状态）
- ✅ 在书下创建章节，章节树展示
- ✅ Tiptap 富文本编辑（H1/H2/粗体/斜体/列表/引用/撤销重做）
- ✅ 1.5 秒防抖自动保存，右上角显示保存状态
- ✅ 中英文友好字数统计
- ✅ 章节标题编辑
- ✅ 删除章节

### 角色管理
- ✅ 角色列表（带头像首字母）
- ✅ 基础字段：姓名、性别、年龄、身份
- ✅ 关系网（角色 ↔ 角色，自定义关系名）
- ✅ 删除角色
- ✅ 完全自定义字段（文本/数字/枚举/日期/URL）

### 设定管理
- ✅ 5 个内置分类：地点/物品/势力/技能/其他
- ✅ 卡片网格视图，按分类分组
- ✅ 标签系统
- ✅ 描述字段
- ✅ 完全自定义字段

### 大纲
- ✅ 树形结构（无限层级）
- ✅ 节点添加/删除
- ✅ 父子节点嵌套
- ✅ 右侧详情面板编辑
- ✅ 快速新建子节点

### 统计
- ✅ 章节数、总字数、平均每章字数、最近更新时间

### 导出
- ✅ 整本 Markdown（按章节顺序）
- ✅ 整本纯文本
- ✅ 整本 **docx**（含封面、目录、章节分页，零依赖）
- ✅ **PDF 打印版**（HTML 版式，浏览器 Ctrl+P 保存）
- ✅ 单章节 Markdown
- ✅ 一键下载

### 专注模式（M2 新增）
- ✅ 全屏沉浸
- ✅ 25 分钟专注 / 5 分钟休息番茄钟（环形进度）
- ✅ 三种白噪音（雨声、炉火、白噪，Web Audio API 生成）
- ✅ 实时字数 + 写作时长统计
- ✅ 自动保存

### 字数热力图（M2 新增）
- ✅ GitHub 风格 180 天写作足迹
- ✅ 自动每日快照（章节保存时触发）
- ✅ 5 级颜色深浅
- ✅ 月份标签
- ✅ 鼠标悬浮查看每日字数

### AI 风格库（M3 完整）
- ✅ 创建/编辑/删除风格
- ✅ 参数：temperature / top_p / 频率惩罚 / 存在惩罚
- ✅ 设为默认风格
- ✅ system prompt 完全自定义

### AI 模型接入（M3 完整）
- ✅ 7 种 provider：OpenAI / Anthropic Claude / DeepSeek / 通义千问 / 智谱 GLM / Ollama 本地 / 自定义 OpenAI 兼容
- ✅ 统一网关 + 流式 SSE
- ✅ Provider 配置管理（API key、本地模型列表自动拉取）
- ✅ 一键测试连通性
- ✅ 自动 fallback 到第一个启用的 provider

### AI 交互（M3 完整）
- ✅ **续写**：基于章节末尾自然续写，支持自定义长度
- ✅ **润色**：改病句、润色文字、保持原意
- ✅ **扩写**：把片段写得详细
- ✅ **缩写**：压缩文字、保留核心
- ✅ **对话**：和 AI 讨论角色、情节、风格，带历史记录
- ✅ `Ctrl+J`（Mac: ⌘+J）唤起 AI 助手
- ✅ 一键插入生成结果到正文

## 🐳 资源占用

| 组件 | 内存（空闲） | 磁盘 |
|---|---|---|
| Frontend (Nginx) | 20MB | 30MB |
| Backend (Node) | 200MB | 200MB |
| PostgreSQL | 100MB | 数据增长 |
| Redis | 30MB | 10MB |
| **合计** | **~350MB** | **~250MB + 数据** |

## 🤝 贡献

欢迎 PR！开发前先看 `docs/DESIGN.md`。

## 📄 License

MIT
