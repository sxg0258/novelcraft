# NovelCraft — Docker 化小说写作工具 方案设计 v1.1

> **代号**：NovelCraft
> **目标平台**：飞牛 NAS（fnOS）为主，通用 Linux Docker 环境兼容
> **形态**：单机/小团队可用，docker-compose 一键部署
> **目标读者**：网络小说作者、传统文学创作者、剧本工作室
> **文档版本**：v1.1  2026-06-18

---

## 0. 写在前面

这份文档回答三件事：
1. **做什么** — 完整的功能清单与用户故事
2. **怎么做** — 技术选型与架构设计
3. **怎么排** — 里程碑与开发节奏
4. **怎么装** — 飞牛 NAS 一键部署脚本与操作手册

如果只能记住一句话：
> **让作者只关心"写"，所有工程化、协作化、AI 化的事情交给容器。**

### 设计原则（v1.1 调整后）

1. **不做方向预设** — 玄幻/言情/历史/科幻不分家，所有角色、设定、AI 风格的字段一律开放给用户自定义
2. **不做合规审查** — 敏感词扫描交给用户自己或第三方工具，本工具专注"让写作更顺"
3. **AI 风格灵活** — 不内置"古风/网文/严肃"等预设风格，用户自建 + 自管理 + 可复用
4. **NAS 友好** — 默认面向飞牛 NAS 优化（绝对路径、x86/arm64 多架构、资源占用低）

---

## 1. 需求收集

### 1.1 用户角色

| 角色 | 描述 | 核心诉求 |
|---|---|---|
| **主笔** | 实际写正文的人 | 不卡顿的编辑器、不打断思路的 AI |
| **设定党** | 维护世界观/角色/时间线的"资料员" | 结构化卡片、交叉引用 |
| **协作者** | 偶尔提建议/改错字的人 | 低门槛、轻量编辑 |

### 1.2 功能模块（按优先级 P0/P1/P2 划分）

#### P0 — MVP 必须有（首版能跑）

| 模块 | 说明 |
|---|---|
| **项目管理** | 新建书、书封面、简介、状态（在写/存稿/已完结） |
| **章节树** | 卷 → 章 → 节的层级树，支持拖拽排序 |
| **富文本编辑器** | Tiptap/Lexical，支持标题、引用、加粗、列表、分割线、脚注 |
| **自动保存** | 每 3 秒静默保存，可查看历史版本（最近 20 版） |
| **本地搜索** | 全文检索章节内容（PostgreSQL tsvector） |
| **角色卡片** | 姓名、性别、年龄、身份、关系网、头像 |
| **设定卡片** | 地点、物品、势力、技能 — 全部自由扩展字段，不做方向预设 |
| **字段类型自定义** | 用户可给任意卡片新增自定义字段（文本/数字/枚举/日期/链接） |
| **大纲视图** | 三段式大纲（起因/经过/结果）或自由节点脑图 |
| **导出** | docx / Markdown / PDF 单本导出 |
| **暗色模式** | 长时间写作不刺眼 |

#### P1 — 增强体验（v1.1~v1.2）

| 模块 | 说明 |
|---|---|
| **AI 续写** | 选中段落 → 让 AI 接续；可调温度、长度 |
| **AI 润色** | 改病句、扩写、缩写、风格自由转换 |
| **AI 对话** | 跟 AI 讨论角色塑造、情节走向（带全书上下文） |
| **AI 风格自定义** | 用户在书级别管理 prompt 模板与风格预设（古风/网文/严肃/自定义），可调温度、top_p、频率惩罚等参数 |
| **伏笔追踪** | 标记"埋伏笔"，在后续章节显示提醒 |
| **时间线视图** | 故事内时间轴 vs 现实写作进度轴 |
| **字数统计** | 日/周/月热力图，目标设定 |
| **专注模式** | 全屏 + 白噪音 + 番茄钟 |
| **外部 API 接入** | OpenAI / Claude / DeepSeek / 通义千问 / 智谱 GLM，统一接口 |
| **本地 Ollama 接入** | 完全离线、隐私优先的可选方案（NAS GPU 用户） |

#### P2 — 高级特性（v2.0+）

| 模块 | 说明 |
|---|---|
| **多人协作** | 实时协同编辑（CRDT），可锁定章节 |
| **评论/批注** | 段落级评论、@协作者 |
| **版本对比** | 任意两版 diff，可回滚 |
| **IP 衍生管理** | 一本书衍生漫画/剧本/设定集 |
| **读者门户** | 选章节生成静态站点，对外发布 |
| **插件系统** | 自定义 AI prompt、自定义导出格式 |
| **移动端** | 响应式 Web，可装 PWA |

### 1.3 用户故事样例

> **US-001** 主笔新建一本《九重天》
> - 给出书名、简介、封面
> - 自动生成默认目录骨架（卷一/卷二...）
> - 一键进入第一章写作界面

> **US-014** 设定党新建角色"林渊"
> - 填基础信息（姓名/性别/年龄）
> - 自定义字段：灵根属性、修为、性格标签
> - 在关系网里挂上"师父 → 林渊"
> - 在章节里 @这个角色，自动生成引用链接

> **US-031** 主笔让 AI 续写一段
> - 光标停在某段末尾
> - 按 `Ctrl+J` 唤起续写面板
> - 选择模型（DeepSeek / GPT-4o / 本地 Qwen）
> - 从自定义风格列表里选一个（或新建一个）
> - 设定温度、top_p、字数
> - AI 生成三选一，可逐句采纳/拒绝

> **US-032** 主笔管理自己的 AI 风格
> - 在"书设置 → AI 风格"里新建风格"古风玄幻"
> - 填名字、描述、prompt 模板、温度等参数
> - 设为当前风格后，`Ctrl+J` 自动套用

---

## 2. 技术选型

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│                   Docker Host (飞牛 NAS / Linux)              │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Frontend │  │ Backend  │  │PostgreSQL│  │  Redis   │    │
│  │  Nginx   │  │  Node.js │  │   15     │  │   7      │    │
│  │  (静态)  │  │  Fastify │  │          │  │ (缓存)   │    │
│  │  :8080   │  │  :3000   │  │  :5432   │  │  :6379   │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │             │             │             │          │
│       └─────────────┴──────┬──────┴─────────────┘          │
│                            │                                │
│                     ┌──────▼──────┐                         │
│                     │   Volumes   │                         │
│                     │  /vol1/1000/│                         │
│                     │   docker/   │                         │
│                     │ novelcraft/ │                         │
│                     └─────────────┘                         │
│                                                             │
│              ┌─────────────────────┐                        │
│              │  Ollama (可选)      │                        │
│              │  :11434             │                        │
│              │  Qwen2.5 / Llama3   │                        │
│              └─────────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 选型决策表

| 层 | 选型 | 备选 | 决策理由 |
|---|---|---|---|
| **前端框架** | Vue 3 + TypeScript | React 18, Svelte | 上手快、中文社区大、模板语法直观 |
| **UI 库** | Naive UI | Element Plus, Ant Design Vue | 主题系统强、暗色模式省心 |
| **编辑器** | Tiptap 2 | Lexical, Quill | ProseMirror 内核、扩展丰富、协同支持好 |
| **状态管理** | Pinia | Vuex | Vue 3 官方推荐 |
| **后端运行时** | Node.js 20 LTS | Bun, Deno | 生态最广、LLM SDK 完备、NAS ARM 兼容性最好 |
| **后端框架** | Fastify | Express, Hono | 性能 2x Express、Schema 校验内置 |
| **数据库** | PostgreSQL 15 | MySQL, SQLite | 全文检索原生、JSON 字段灵活；SQLite 单文件备份简单但并发弱 |
| **ORM** | Prisma | Drizzle, TypeORM | 类型安全、迁移工具完善 |
| **缓存/队列** | Redis 7 | — | BullMQ 任务队列、Session 存储 |
| **AI 网关** | LiteLLM 兼容层 | 自研 | 统一各家 API、自动 fallback |
| **文件存储** | 本地卷（NAS 主盘） | MinIO | NAS 自带大硬盘，不引入额外存储组件 |
| **导出引擎** | Pandoc + LibreOffice | docx4j | docx/pdf 全场景覆盖 |
| **反向代理** | 内置 Nginx（前容器内） | Caddy | 减少一个容器、降低内存占用 |
| **容器编排** | docker compose | k8s | 单机/小团队/NAS 场景够用 |

### 2.3 NAS 专项优化决策

| 约束 | 处理方式 |
|---|---|
| **ARM64 vs x86** | 所有基础镜像用 `linux/arm64` 和 `linux/amd64` 双 tag 发布，飞牛用户群以 x86 为主 |
| **磁盘 IO** | PostgreSQL 关闭 fsync、关闭 full page writes（NAS 场景，数据可从备份恢复） |
| **内存占用** | Node.js 加 `--max-old-space-size=512`，Redis 设 `maxmemory 256mb` |
| **磁盘占用** | 编辑器自动保存只保留 20 版，不做无限历史 |
| **启动时间** | 后端镜像用 multi-stage build，最终镜像 < 200MB |
| **网络** | 飞牛默认反向代理套娃容易出问题，本工具自带前端 Nginx 直出，不依赖飞牛的反代 |

### 2.4 数据模型（核心表）

```sql
-- 书
CREATE TABLE books (
  id UUID PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  cover_url TEXT,
  summary TEXT,
  status VARCHAR(20),  -- drafting / archiving / completed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 章节（树形）
CREATE TABLE chapters (
  id UUID PRIMARY KEY,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES chapters(id),
  title VARCHAR(200) NOT NULL,
  content JSONB,        -- Tiptap JSON 格式
  content_text TEXT,    -- 纯文本，用于检索
  word_count INT DEFAULT 0,
  position INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 角色
CREATE TABLE characters (
  id UUID PRIMARY KEY,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  attributes JSONB,     -- 灵活字段：性别/年龄/修为...
  relations JSONB       -- 关系网：[{"to":"id","type":"师徒"}]
);

-- 设定项（通用：地点/物品/势力/技能）
CREATE TABLE world_items (
  id UUID PRIMARY KEY,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  category VARCHAR(50),  -- location / item / faction / skill
  name VARCHAR(100) NOT NULL,
  attributes JSONB,
  tags TEXT[]
);

-- 自定义字段定义（用户加的字段长啥样）
CREATE TABLE custom_field_defs (
  id UUID PRIMARY KEY,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  target_type VARCHAR(20),  -- 'character' / 'world_item'
  name VARCHAR(50),
  field_type VARCHAR(20),   -- text / number / enum / date / url
  config JSONB              -- enum 选项等
);

-- 大纲节点
CREATE TABLE outlines (
  id UUID PRIMARY KEY,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES outlines(id),
  title VARCHAR(200),
  content TEXT,
  position INT
);

-- AI 风格预设（书级别）
CREATE TABLE ai_styles (
  id UUID PRIMARY KEY,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  system_prompt TEXT,
  temperature REAL DEFAULT 0.7,
  top_p REAL DEFAULT 1.0,
  frequency_penalty REAL DEFAULT 0.0,
  presence_penalty REAL DEFAULT 0.0,
  is_default BOOLEAN DEFAULT FALSE
);

-- AI 对话会话
CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY,
  book_id UUID REFERENCES books(id),
  chapter_id UUID REFERENCES chapters(id),
  ai_style_id UUID REFERENCES ai_styles(id),
  provider VARCHAR(50),   -- openai / claude / ollama / ...
  messages JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 全文检索（自动维护）
CREATE INDEX chapters_fts_idx ON chapters
  USING GIN (to_tsvector('simple', content_text));
```

### 2.5 AI 集成方案

设计一个统一的 **AI Gateway** 抽象层，前端只关心"用什么模型、写什么 prompt"，不直接对接各家 API。

```typescript
// 后端接口
interface AIProvider {
  chat(req: ChatRequest): Promise<ChatResponse>
  stream(req: ChatRequest): AsyncIterable<string>
}

// 支持的 provider
type ProviderName =
  | 'openai'      // GPT-4o, o1
  | 'anthropic'   // Claude 3.5/4
  | 'deepseek'    // DeepSeek-V3
  | 'qwen'        // 通义千问
  | 'glm'         // 智谱 GLM-4
  | 'ollama'      // 本地模型
  | 'custom';     // 兼容 OpenAI 协议的自定义端点

// 用户在"设置 → AI 模型"里配置：
// - 每种 provider 的 API key / base_url
// - 默认模型、温度、最大 token
```

---

## 3. Docker 架构

### 3.1 目录结构

```
novelcraft/
├── docker-compose.yml          # 总编排
├── .env.example                # 环境变量样例
├── README.md
├── deploy/
│   └── nginx.conf              # 前端 Nginx 配置
├── backend/                    # Fastify API
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   └── prisma/
│       └── schema.prisma
├── frontend/                   # Vue 3 SPA
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
└── data/                       # 持久化（git 忽略）
    ├── postgres/
    ├── redis/
    └── files/                  # 用户上传的图片/附件
```

### 3.2 docker-compose.yml（飞牛 NAS 优化版）

```yaml
version: '3.9'

# 网络固定 subnet，避免飞牛重启后 IP 漂移
networks:
  novelcraft:
    driver: bridge
    ipam:
      config:
        - subnet: 172.30.0.0/24

services:
  frontend:
    build: ./frontend
    container_name: novelcraft-frontend
    restart: unless-stopped
    ports:
      - "5210:80"               # 避开飞牛占用的 80/443/8080，自定义端口
    depends_on:
      - backend
    networks:
      novelcraft:
        ipv4_address: 172.30.0.10

  backend:
    build: ./backend
    container_name: novelcraft-backend
    restart: unless-stopped
    environment:
      DATABASE_URL: postgres://novelcraft:${DB_PASSWORD}@db:5432/novelcraft
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      NODE_OPTIONS: "--max-old-space-size=512"
      TZ: Asia/Shanghai
    depends_on:
      - db
      - redis
    volumes:
      - ${DATA_PATH}/files:/app/files
    networks:
      novelcraft:
        ipv4_address: 172.30.0.20

  db:
    image: postgres:15-alpine
    container_name: novelcraft-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: novelcraft
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: novelcraft
      TZ: Asia/Shanghai
    # 飞牛场景：关闭 fsync 减少磁盘 IO（牺牲一点点安全性换流畅度）
    command:
      - "postgres"
      - "-c"
      - "fsync=off"
      - "-c"
      - "full_page_writes=off"
      - "-c"
      - "shared_buffers=128MB"
      - "-c"
      - "effective_cache_size=256MB"
    volumes:
      - ${DATA_PATH}/postgres:/var/lib/postgresql/data
    networks:
      novelcraft:
        ipv4_address: 172.30.0.30

  redis:
    image: redis:7-alpine
    container_name: novelcraft-redis
    restart: unless-stopped
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - ${DATA_PATH}/redis:/data
    networks:
      novelcraft:
        ipv4_address: 172.30.0.40

  # 可选：本地 AI 模型（如果用户想完全离线）
  # 飞牛用户大部分是 N100/J4125 等无独显小主机，7B 模型勉强能跑
  ollama:
    image: ollama/ollama:latest
    container_name: novelcraft-ollama
    profiles: ["ai-local"]  # 默认不启动，--profile ai-local 启用
    restart: unless-stopped
    volumes:
      - ${DATA_PATH}/ollama:/root/.ollama
    ports:
      - "11434:11434"
    networks:
      novelcraft:
        ipv4_address: 172.30.0.50
```

### 3.3 环境变量样例（.env.example）

```bash
# 数据库密码（首次启动后请修改）
DB_PASSWORD=ChangeMe_StrongPass123

# JWT 密钥（首次启动后请修改为随机字符串）
JWT_SECRET=ChangeMe_JwtSecret_RandomString

# 数据存储根路径（飞牛 NAS 推荐 /vol1/1000/docker/novelcraft）
DATA_PATH=/vol1/1000/docker/novelcraft

# 时区
TZ=Asia/Shanghai
```

---

## 4. 飞牛 NAS 部署手册

### 4.1 前置准备

#### 4.1.1 确认硬件
- 飞牛 fnOS **0.8+**（推荐 0.9/1.0+）
- CPU：**x86_64 小主机**（Intel N100 / J4125 / i3-N305 / 锐龙 mini）— 用户群主流
- 内存：**≥ 4GB**（MVP 最低），推荐 **≥ 8GB**（带 AI 时）
- 可用磁盘：**≥ 5GB**（不含 AI 模型）

> 飞牛官方镜像内置 Docker 应用，如果没看到 Docker，在应用中心搜"Docker"安装。

#### 4.1.2 切换镜像源（强烈建议）
飞牛默认的 Docker Hub 在国内很慢，先加镜像源：
1. 打开 Docker 应用 → 镜像仓库 → 仓库设置 → 添加
2. 推荐源（二选一）：
   - `https://docker.1ms.run`
   - `https://docker.1panel.live`
3. 添加后启用，然后**重启 Docker 服务**（Docker 应用右上角"停止"再"启动"）

### 4.2 一键部署（推荐：图形界面）

#### 步骤 1：创建项目目录
1. 打开飞牛"文件管理"App
2. 进入 `/vol1/1000/docker/`（如果没有 docker 文件夹就新建）
3. 新建文件夹 `novelcraft`
4. 进入 `novelcraft`，**提前创建好以下子目录**（权限预留给容器）：
   - `data/postgres`
   - `data/redis`
   - `data/files`
   - `data/ollama`（如果要用本地 AI）

#### 步骤 2：上传配置文件
需要上传 4 个文件到 `/vol1/1000/docker/novelcraft/`：

```
novelcraft/
├── docker-compose.yml
├── .env
├── backend/
│   └── Dockerfile
└── frontend/
    └── Dockerfile
```

文件内容见附录 A。

> ⚠️ 飞牛文件管理不支持直接创建空文件。先在电脑上创建空白 `.txt` 再重命名上传。
> 或者用 FinalShell 通过 SSH 上传（推荐）。

#### 步骤 3：通过 SSH 拉取镜像并启动（**比 GUI 更快**）
```bash
# 1. SSH 连接飞牛（飞牛后台 → 设置 → SSH → 启用，默认 22 端口）
ssh admin@你的飞牛IP

# 2. 切到 root（避免权限问题）
sudo -i

# 3. 进入项目目录
cd /vol1/1000/docker/novelcraft

# 4. 拉取镜像（用国内源快很多）
docker compose pull

# 5. 启动
docker compose up -d

# 6. 查看启动状态
docker compose ps
docker compose logs -f backend    # 看后端启动日志
```

#### 步骤 4：访问应用
浏览器打开：
```
http://你的飞牛IP:5210
```

首次进入会引导创建管理员账号。

#### 步骤 5（可选）：启用本地 AI
```bash
# 启动 Ollama 服务
docker compose --profile ai-local up -d ollama

# 进入 Ollama 容器拉模型（首次需要下载几个 G）
docker exec -it novelcraft-ollama ollama pull qwen2.5:7b
# 拉完就能在前端"AI 设置"里选 ollama 作为 provider
```

### 4.3 升级 / 维护

```bash
# SSH 进飞牛后
cd /vol1/1000/docker/novelcraft

# 拉新镜像并重启
docker compose pull
docker compose up -d

# 数据备份（关键！建议挂个定时任务）
docker compose exec db pg_dump -U novelcraft novelcraft > backup_$(date +%Y%m%d).sql

# 查看资源占用
docker stats --no-stream
```

### 4.4 常见问题

| 问题 | 排查 |
|---|---|
| 启动报"permission denied" | `chmod -R 777 /vol1/1000/docker/novelcraft/data` |
| 端口 5210 被占 | 改 `docker-compose.yml` 里 `5210:80` 为 `15210:80`（或任意空闲端口） |
| 后端连不上数据库 | 看 `docker compose logs db`，等 30 秒再试（首次启动要初始化） |
| 镜像拉不动 | 检查 `~/.docker/daemon.json` 里有没有加 `docker.1ms.run` 镜像源 |
| 想外网访问 | 飞牛后台 → 设置 → DDNS 配域名 + 路由器开 5210 端口（注意安全） |
| ARM 机器用不了 | 所有镜像已发布 `linux/arm64` tag，理论上能跑；如果不行贴 `docker compose logs` |

---

## 5. 里程碑

### M0 — 准备（1 周）
- [ ] 仓库初始化、CI/CD（GitHub Actions 多架构构建）
- [ ] docker-compose 骨架
- [ ] CI 自动构建并 push 镜像到 Docker Hub / GHCR
- [ ] 飞牛部署文档

### M1 — MVP（4 周）
- [ ] 用户登录（JWT，本地账号）
- [ ] 书/章节 CRUD
- [ ] Tiptap 编辑器 + 自动保存（最近 20 版）
- [ ] 角色卡 + 设定卡（含自定义字段）
- [ ] 全文搜索
- [ ] 导出 docx/pdf

### M2 — 体验增强（3 周）
- [ ] 大纲视图
- [ ] 伏笔标记
- [ ] 字数统计 + 热力图
- [ ] 专注模式 + 番茄钟
- [ ] 暗色模式

### M3 — AI 集成（3 周）
- [ ] AI Gateway 抽象层
- [ ] 外部 API 接入（OpenAI/Claude/DeepSeek/Qwen）
- [ ] 本地 Ollama 接入
- [ ] 续写/润色/对话功能
- [ ] Prompt 模板 + 风格库管理（书级别）

### M4 — 协作 & 高级（按需）
- [ ] 多人协同编辑（Yjs）
- [ ] 评论批注
- [ ] 版本对比
- [ ] 移动端 PWA

---

## 6. 风险 & 应对

| 风险 | 影响 | 应对 |
|---|---|---|
| Tiptap 协同编辑复杂度高 | M4 延期 | 前期用乐观锁，协同延后 |
| AI API 不稳定 | 用户体验差 | 多 provider 自动 fallback |
| 大文件（百万字）性能 | 卡顿 | 分段懒加载、按需编译 |
| 中文分词检索不准 | 搜索体验差 | 集成 zhparser 或 jieba |
| 自定义字段 schema 演化 | 老数据兼容 | attributes 字段始终保持向前兼容的 JSON 形态 |
| NAS 磁盘 IO 差 | 卡顿 | PostgreSQL 关 fsync、Redis 限内存、文件存主盘避开机械盘 |
| ARM 镜像兼容性 | 部分飞牛用户跑不起来 | CI 多架构构建、飞牛用户以 x86 为主 |

---

## 7. 下一步

确认这份方案后，建议下一步动作：
1. **技术验证**：用 1 周时间跑通 "docker compose up 后能编辑保存" 的最小闭环
2. **预构建镜像**：先把 frontend/backend 镜像推到 GHCR，用户部署时不用本地 build
3. **UI 设计稿**：先出关键页面（编辑器、章节树、角色卡）的交互稿
4. **细化数据模型**：根据用户测试反馈迭代

---

## 附录 A：飞牛直接可用的部署文件

> 这部分文件等 M1 开发完成后会同步更新到仓库 Release。
> 这里先给出一份占位版，让你可以提前拉起来跑通流程。

### A.1 docker-compose.yml
见正文 3.2 节。

### A.2 .env
```bash
DB_PASSWORD=NovelCraft@2026
JWT_SECRET=please_change_to_a_long_random_string
DATA_PATH=/vol1/1000/docker/novelcraft
TZ=Asia/Shanghai
```

### A.3 镜像预构建计划
- `ghcr.io/novelcraft/frontend:latest` — 前端静态包
- `ghcr.io/novelcraft/backend:latest` — Fastify API
- `postgres:15-alpine`、`redis:7-alpine`、`ollama/ollama:latest` — 官方镜像
- **多架构**：linux/amd64 + linux/arm64

要不要我接着出 **Prisma 完整 schema** 和 **后端 API 详细设计**（Fastify 路由清单 + 数据流图）？或者你想先看看**前端关键页面**的草图？
