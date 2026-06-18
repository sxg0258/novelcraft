# NovelCraft 飞牛 NAS 完整部署教程

> 目标：把你开发机上的 NovelCraft 项目，部署到飞牛 NAS 上跑起来。
> 适用人群：用飞牛 fnOS 的 x86 小主机用户（N100 / J4125 / i3-N305 / 锐龙 mini 等）
> 预计时间：30~60 分钟（取决于网速）

---

## 0. 最快路径：GHCR 镜像一键部署（推荐！）

如果你已经配置好了 GitHub Actions 自动构建（项目里有 `.github/workflows/build.yml`），**最快 1 分钟**就能跑起来：

### 步骤 1：触发 GitHub Actions 构建

**方式 A：推 tag 自动触发**

```bash
# 在开发机上
git tag v1.0.0
git push origin v1.0.0
```

**方式 B：手动触发**

1. 打开 GitHub 仓库 → **Actions** → **Build & Push Docker Images**
2. 点 **Run workflow** → 选 branch → 填 tag（如 `1.0.0`，留空用 `latest`）→ 运行
3. 等 5~10 分钟（首次构建），看 Actions 是否绿勾 ✅

构建完会得到两个镜像：
- `ghcr.io/<你的用户名>/novelcraft-backend:1.0.0`
- `ghcr.io/<你的用户名>/novelcraft-frontend:1.0.0`

### 步骤 2：在飞牛上一行部署

SSH 进飞牛，**粘贴这一行**：

```bash
curl -L https://raw.githubusercontent.com/<你的用户名>/novelcraft/main/deploy/deploy.sh -o /tmp/deploy.sh && \
GHCR_USER=<你的用户名> bash /tmp/deploy.sh
```

> ⚠️ **把 `<你的用户名>` 替换成你的 GitHub 用户名**（两次）

脚本会：
1. ✅ 自动创建目录结构
2. ✅ 自动生成随机密码
3. ✅ 自动写 docker-compose.yml（指向 GHCR 镜像）
4. ✅ 拉取最新镜像
5. ✅ 启动 4 个容器
6. ✅ 健康检查
7. ✅ 告诉你访问地址

### 步骤 3：访问

浏览器打开 `http://飞牛IP:5210`，注册第一个用户（**自动成为管理员**）。

---

## 目录

1. [部署方式选择](#1-部署方式选择)
2. [前置准备](#2-前置准备)
3. [方式 A：本地构建镜像（推荐）](#3-方式-a本地构建镜像推荐)
4. [方式 B：上传项目 + 飞牛本地构建](#4-方式-b上传项目--飞牛本地构建)
5. [验证部署成功](#5-验证部署成功)
6. [首次使用配置](#6-首次使用配置)
7. [常见问题排查](#7-常见问题排查)
8. [日常运维](#8-日常运维)

---

## 1. 部署方式选择

你有两种方式把 NovelCraft 装到飞牛：

| 方式 | 优点 | 缺点 | 适用场景 |
|---|---|---|---|
| **A. 本地构建 + 上传镜像** | 飞牛只负责运行，构建在你开发机上；构建快、可重复 | 多一步上传；镜像体积大 | **网络好、镜像源已配、推得动** |
| **B. 上传源码 + 飞牛构建** | 不上传大镜像，只传代码；改动方便 | 飞牛构建慢（CPU 弱）；需要项目源码完整 | **网络一般、镜像源不稳、本地无 Docker** |

**我推荐方式 A**——你开发机有 Docker，构建后打个 tar，飞牛 `docker load` 一下就跑。整个过程 5~10 分钟，失败也好排查。

下面两种都写。

---

## 2. 前置准备

### 2.1 硬件检查

在飞牛 Web 后台 → 系统信息，确认：

- ✅ **CPU**：x86_64 架构（N100/J4125/i3-N305/锐龙都行）
- ✅ **内存**：≥ 4GB（推荐 8GB+，开 AI 时）
- ✅ **磁盘**：≥ 5GB 可用空间（不含 AI 模型）
- ✅ **网络**：能访问互联网（拉镜像用）

### 2.2 确认 Docker 已安装

飞牛 fnOS 0.8+ 一般自带 Docker。在飞牛桌面找到 **Docker** 应用图标：

- ✅ 看到 → 直接进入下一步
- ❌ 没看到 → 飞牛应用中心搜索 "Docker" 安装

### 2.3 切换国内镜像源（**强烈建议**，否则拉镜像慢到哭）

1. 打开飞牛 **Docker** 应用
2. 右上角 → **镜像仓库** → **仓库设置**
3. 点 **添加**，填入下面任一个国内源：

```
# 推荐（按速度排序，试哪个快用哪个）
https://docker.1ms.run
https://docker.1panel.live
https://docker.m.daocloud.io
```

4. 保存后 → **启用** 这个源
5. **重启 Docker 服务**（Docker 应用右上角"停止"再"启动"）

> 💡 不知道哪个快？三个都加，飞牛会自动按顺序尝试。

### 2.4 开启 SSH

1. 飞牛 Web 后台 → **设置** → **SSH**
2. 勾选 **启用 SSH 服务**
3. 端口默认 `22`，不动
4. 保存

### 2.5 在电脑上准备 SSH 客户端

**Windows 用户**（你大概率是）：
- 用系统自带的 PowerShell 就行（按 `Win + X` → 选"终端"或"PowerShell"）
- 或者装 [FinalShell](https://www.hostbuf.com/)（图形化，免费，新手友好）

**Mac/Linux 用户**：
- 直接用 Terminal 就行

---

## 3. 方式 A：本地构建 + 上传镜像

### 3.1 在你开发机上（E:\monimax-code 这台）

#### 步骤 1：打开 PowerShell，进入项目目录

```powershell
cd E:\monimax-code\novelcraft
```

#### 步骤 2：构建后端镜像

```powershell
cd backend
docker build -t novelcraft-backend:1.0 .
cd ..
```

第一次构建需要 5~10 分钟（下载 Node 基础镜像 + 安装 npm 依赖 + Prisma 生成）。

#### 步骤 3：构建前端镜像

```powershell
cd frontend
docker build -t novelcraft-frontend:1.0 .
cd ..
```

第一次构建 3~5 分钟。

#### 步骤 4：导出镜像为 tar 文件

```powershell
mkdir deploy-tar
docker save -o deploy-tar/novelcraft-backend.tar novelcraft-backend:1.0
docker save -o deploy-tar/novelcraft-frontend.tar novelcraft-frontend:1.0

# 顺便导出官方依赖镜像
docker pull postgres:15-alpine
docker pull redis:7-alpine
docker save -o deploy-tar/postgres-15-alpine.tar postgres:15-alpine
docker save -o deploy-tar/redis-7-alpine.tar redis:7-alpine

# 看下文件大小
Get-ChildItem deploy-tar
```

预计 4 个 tar 文件，总共 200~300MB。

#### 步骤 5：上传到飞牛

**方式 A1：scp 上传（推荐）**

```powershell
# 先在飞牛上创建目录
ssh admin@你的飞牛IP "mkdir -p /vol1/1000/docker/novelcraft/images"

# 上传（PowerShell 里）
scp deploy-tar\*.tar admin@你的飞牛IP:/vol1/1000/docker/novelcraft/images/
```

**方式 A2：用飞牛文件管理**

直接打开飞牛 Web → 文件管理 → `/vol1/1000/docker/novelcraft/images/` → 拖拽上传（适合网络不稳定时分批传）。

### 3.2 在飞牛上加载镜像

SSH 进飞牛：

```bash
ssh admin@你的飞牛IP
sudo -i
```

加载所有镜像：

```bash
cd /vol1/1000/docker/novelcraft/images
docker load -i novelcraft-backend.tar
docker load -i novelcraft-frontend.tar
docker load -i postgres-15-alpine.tar
docker load -i redis-7-alpine.tar

# 验证镜像已加载
docker images | grep -E "novelcraft|postgres|redis"
```

应该看到：

```
novelcraft-backend   1.0    ...
novelcraft-frontend  1.0    ...
postgres             15-alpine
redis                7-alpine
```

---

## 4. 方式 B：上传源码 + 飞牛构建

> 适合：方式 A 上传太慢，或者你想在飞牛上直接改代码。

### 4.1 在飞牛上创建目录

```bash
ssh admin@你的飞牛IP
sudo -i

mkdir -p /vol1/1000/docker/novelcraft/{data/{postgres,redis,files},src}
cd /vol1/1000/docker/novelcraft/src
```

### 4.2 上传源码（只传代码，不传 node_modules）

**在开发机上**：

```powershell
# 用 rsync 排除 node_modules 等（如果开发机装了 rsync）
# 或者直接打包压缩

cd E:\monimax-code
tar -czf novelcraft-src.tar.gz --exclude=node_modules --exclude=.git --exclude=dist novelcraft

# 上传到飞牛
scp novelcraft-src.tar.gz admin@你的飞牛IP:/vol1/1000/docker/novelcraft/src/
```

### 4.3 在飞牛上解压并构建

```bash
cd /vol1/1000/docker/novelcraft/src
tar -xzf novelcraft-src.tar.gz
cd novelcraft

# 准备数据目录（让 docker 能挂载）
mkdir -p /vol1/1000/docker/novelcraft/data/{postgres,redis,files}

# 准备 .env
cat > .env <<'EOF'
DB_PASSWORD=NovelCraft@2026_ChangeMe
JWT_SECRET=please_change_to_a_long_random_string_at_least_32_chars_xyz123
DATA_PATH=/vol1/1000/docker/novelcraft
TZ=Asia/Shanghai
EOF

# 启动（飞牛会本地构建 backend + frontend 镜像）
docker compose up -d --build
```

第一次构建在飞牛上比较慢（N100 小主机大概 15~30 分钟），可以喝杯茶。

---

## 5. 创建并启动项目（两种方式通用）

### 5.1 创建 compose 配置文件

```bash
mkdir -p /vol1/1000/docker/novelcraft
cd /vol1/1000/docker/novelcraft
```

新建 `docker-compose.yml`：

```bash
cat > docker-compose.yml <<'EOF'
version: '3.9'

networks:
  novelcraft:
    driver: bridge
    ipam:
      config:
        - subnet: 172.30.0.0/24

services:
  frontend:
    image: novelcraft-frontend:1.0   # 方式 A 用；方式 B 改成 build: ./src/novelcraft/frontend
    container_name: novelcraft-frontend
    restart: unless-stopped
    ports:
      - "5210:80"
    depends_on:
      - backend
    networks:
      novelcraft:
        ipv4_address: 172.30.0.10

  backend:
    image: novelcraft-backend:1.0    # 方式 A 用；方式 B 改成 build: ./src/novelcraft/backend
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
    command:
      - "postgres"
      - "-c"
      - "fsync=off"
      - "-c"
      - "full_page_writes=off"
      - "-c"
      - "shared_buffers=128MB"
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

  # 可选：本地 AI（按需启用）
  ollama:
    image: ollama/ollama:latest
    container_name: novelcraft-ollama
    profiles: ["ai-local"]
    restart: unless-stopped
    volumes:
      - ${DATA_PATH}/ollama:/root/.ollama
    ports:
      - "11434:11434"
    networks:
      novelcraft:
        ipv4_address: 172.30.0.50
EOF
```

### 5.2 创建 .env 文件

```bash
cat > .env <<'EOF'
DB_PASSWORD=NovelCraft@2026_ChangeMe
JWT_SECRET=please_change_to_a_long_random_string_at_least_32_chars_xyz123abc
DATA_PATH=/vol1/1000/docker/novelcraft
TZ=Asia/Shanghai
EOF
```

> ⚠️ **首次启动后务必修改这两个密码**！

### 5.3 创建数据目录（首次部署必须）

```bash
mkdir -p /vol1/1000/docker/novelcraft/data/{postgres,redis,files}
chmod -R 777 /vol1/1000/docker/novelcraft/data
```

### 5.4 启动

```bash
cd /vol1/1000/docker/novelcraft
docker compose up -d
```

输出应该是：

```
[+] Running 4/4
 ✔ Container novelcraft-redis     Started
 ✔ Container novelcraft-db        Started
 ✔ Container novelcraft-backend   Started
 ✔ Container novelcraft-frontend  Started
```

### 5.5 验证启动状态

```bash
docker compose ps
```

应该看到 4 个容器都是 `running` 或 `healthy`。

看后端启动日志（重点看有没有报错）：

```bash
docker compose logs backend --tail=50
```

正常会看到：

```
NovelCraft backend ready on http://0.0.0.0:3000
```

---

## 6. 验证部署成功

### 6.1 浏览器访问

打开浏览器，地址栏输入：

```
http://你的飞牛IP:5210
```

> 飞牛 IP 怎么看？飞牛桌面 → 系统信息 → IP 地址（一般是 `192.168.x.x` 或 `10.x.x.x`）

应该看到 **NovelCraft** 的欢迎页（登录/注册页）。

### 6.2 注册第一个用户

⚠️ **第一个注册的用户自动成为管理员**（这是我们写死的逻辑）：

1. 点 **注册** 标签
2. 用户名（≥3 字符）：`admin`
3. 密码（≥6 字符）：`你的强密码`
4. 昵称（可选）：`管理员`
5. 点 **注册** → 自动登录

### 6.3 创建第一本书

登录后：
1. 左侧栏点 **+ 新建书**
2. 书名：《测试书》
3. 简介：（随便写点）
4. 创建 → 自动进入写作界面
5. 在章节树点 **+ 新章节** → 写几个字 → 看右上角是否变 "已保存 XX:XX"

### 6.4 测试关键功能

打开浏览器 DevTools（F12）→ Console，输入：

```javascript
// 测试 API
fetch('/api/health').then(r => r.json()).then(console.log)
// 应该输出: {status: 'ok', version: '0.4.0', ...}

// 测试 AI 设置 API（即使没配 AI 也能拿到 provider 列表）
fetch('/api/ai/providers/meta').then(r => r.json()).then(console.log)
```

如果都正常返回 JSON，**部署成功** 🎉

---

## 7. 首次使用配置

### 7.1 修改默认密码

登录后，强烈建议修改数据库密码（虽然用户密码已经改了，但 DB 密码还是 `.env` 里的默认值）：

```bash
# SSH 进飞牛
cd /vol1/1000/docker/novelcraft

# 编辑 .env
nano .env
# 把 DB_PASSWORD 和 JWT_SECRET 改成随机的强密码
# 比如：openssl rand -hex 32

# 重启后端（让它读新环境变量）
docker compose restart backend
```

### 7.2 配置 AI（可选）

如果你要用 AI 续写/润色功能：

1. Web 界面 → 左侧栏底部 → **⚙️ AI 设置**
2. **API 提供方** 标签 → **+ 添加 API 提供方**
3. 推荐选 **DeepSeek**（性价比高，中文好）：
   - 显示名：`我的 DeepSeek`
   - 类型：`DeepSeek`
   - API Key：去 https://platform.deepseek.com 注册并生成
   - 默认模型：`deepseek-chat`
4. 保存 → 点 **测试** → 看到 `✅ OK` 就成功了

### 7.3 启用本地 AI（可选，仅大内存机器）

如果你飞牛内存 ≥ 16GB 且有 N100/i3-N305 这类 CPU，可以跑本地模型：

```bash
cd /vol1/1000/docker/novelcraft
docker compose --profile ai-local up -d ollama

# 拉个 7B 模型（首次要下几个 GB）
docker exec -it novelcraft-ollama ollama pull qwen2.5:7b

# 前端 AI 设置 → 添加 Ollama provider，base URL: http://ollama:11434/v1
```

---

## 8. 常见问题排查

### 问题 1：访问 `http://飞牛IP:5210` 打不开

**排查步骤**：

```bash
# 1. 看容器在不在跑
docker compose ps

# 2. 看 frontend 日志
docker compose logs frontend --tail=30

# 3. 在飞牛本地 curl 测试（确认是网络问题还是服务问题）
curl http://localhost:5210
# 如果能返回 HTML，就是外网访问问题
# 如果连不上，看 frontend 日志报错
```

**最常见原因**：
- 飞牛防火墙没放行 5210 → 飞牛后台 → 防火墙 → 添加规则
- 5210 被占用 → `lsof -i:5210` 查谁在用，改 docker-compose.yml 的端口
- 启动顺序问题 → 等 30 秒再试（数据库初始化需要时间）

### 问题 2：镜像拉取失败 / 超时

```bash
# 检查镜像源配置
cat /etc/docker/daemon.json

# 手动测试拉镜像
docker pull hello-world

# 不行就换源：
# https://docker.1ms.run
# https://docker.1panel.live
# https://docker.m.daocloud.io
```

### 问题 3：后端启动失败 "ECONNREFUSED db:5432"

数据库没就绪。多等 30 秒，或者：

```bash
# 看 db 日志
docker compose logs db --tail=50

# 重启后端（数据库启动需要时间）
docker compose restart backend
```

### 问题 4：首次注册提示 "username_taken"

之前注册过。清掉数据重来：

```bash
cd /vol1/1000/docker/novelcraft
docker compose down
rm -rf data/postgres/*
docker compose up -d
```

⚠️ **这会清空所有数据！**

### 问题 5：磁盘满 / docker 占用大

```bash
# 看磁盘占用
df -h /vol1/1000/docker
du -sh /vol1/1000/docker/novelcraft/data/*

# 清理无用镜像
docker image prune -a

# 清理 PostgreSQL WAL
docker compose exec db psql -U novelcraft -d novelcraft -c "VACUUM FULL;"
```

### 问题 6：AI 调用失败 / 超时

```bash
# 看后端日志（会显示具体哪个 provider 报什么错）
docker compose logs backend --tail=100 | grep -A5 -i "AI\|provider\|error"

# 最常见：API key 填错 / 没余额 / 网络问题
# 在前端 AI 设置 → 测试 按钮可以快速验证
```

### 问题 7：服务挂了自动重启不了

```bash
# 查看具体错误
docker compose logs backend --tail=100

# 重启整个 stack
cd /vol1/1000/docker/novelcraft
docker compose restart

# 还不行就硬重启
docker compose down
docker compose up -d
```

---

## 9. 日常运维

### 9.1 备份数据

```bash
# JSON 全量备份（推荐，每周一次）
curl http://localhost:5210 -o /dev/null  # 触发一下应用启动
# 或者直接用 Web 界面：导出标签 → 导出 JSON 备份

# PostgreSQL 数据库备份（更彻底）
cd /vol1/1000/docker/novelcraft
docker compose exec db pg_dump -U novelcraft novelcraft > backup_$(date +%Y%m%d).sql

# 建议挂个定时任务，每天凌晨自动备份
crontab -e
# 加一行：
# 0 3 * * * cd /vol1/1000/docker/novelcraft && docker compose exec -T db pg_dump -U novelcraft novelcraft > /vol1/1000/docker/novelcraft/backups/db_$(date +\%Y\%m\%d).sql
```

### 9.2 升级到新版本

```bash
cd /vol1/1000/docker/novelcraft

# 拉新镜像（方式 A）
docker compose pull

# 或者重新构建（方式 B）
docker compose build --pull

# 重启
docker compose up -d

# 看启动状态
docker compose ps
docker compose logs backend --tail=20
```

### 9.3 查看资源占用

```bash
# 实时
docker stats

# 简略
docker compose ps
```

### 9.4 完全卸载

```bash
cd /vol1/1000/docker/novelcraft
docker compose down          # 停服务
docker compose down --volumes # 同时删数据卷
rm -rf /vol1/1000/docker/novelcraft  # 删目录
docker image rm novelcraft-backend:1.0 novelcraft-frontend:1.0
```

---

## 10. 外网访问（可选）

⚠️ 安全提示：把 NAS 暴露到公网有风险，**务必做好以下**：
1. 改强密码
2. 不要用默认 5210 端口（换高位端口）
3. 飞牛后台开启 DDNS + 配置 https

```bash
# 1. 在飞牛后台：设置 → DDNS → 添加（飞牛自带，免费）

# 2. 路由器端口映射
#    外网 15210 → 内网 飞牛IP:5210

# 3. 浏览器访问
#    http://你的域名.飞牛nas.com:15210
```

更安全的方案：套一层 Cloudflare Tunnel 或 Tailscale，**不要直接暴露 5210 到公网**。

---

## 11. 部署完成检查清单

- [ ] 4 个容器都在 running
- [ ] `http://飞牛IP:5210` 能打开
- [ ] 注册第一个用户成功
- [ ] 新建书 + 新章节 + 写几个字能保存
- [ ] `Ctrl+K` 能搜到刚写的内容
- [ ] `Ctrl+J` 能打开 AI 助手
- [ ] 修改了 .env 里的默认密码
- [ ] 配置了数据库备份定时任务

全勾选就 OK 了，可以开始写小说 🚀

---

## 附录 A：架构速查

```
飞牛 NAS (192.168.x.x)
├── Docker
│   ├── novelcraft-frontend  :5210  (nginx 静态托管)
│   ├── novelcraft-backend   :3000  (Fastify API)
│   ├── novelcraft-db        :5432  (PostgreSQL 15)
│   ├── novelcraft-redis     :6379  (Redis 7)
│   └── novelcraft-ollama    :11434 (可选，本地 AI)
└── 数据卷
    └── /vol1/1000/docker/novelcraft/data/
        ├── postgres/   (数据库文件)
        ├── redis/      (缓存)
        └── files/      (用户上传文件)
```

## 附录 B：关键端口

| 端口 | 服务 | 用途 |
|---|---|---|
| 5210 | Frontend | **Web 访问入口** |
| 3000 | Backend | API（仅容器内部） |
| 5432 | PostgreSQL | DB（仅容器内部） |
| 6379 | Redis | 缓存（仅容器内部） |
| 11434 | Ollama | 可选 AI（仅本机或 LAN） |

## 附录 C：常用命令速查

```bash
# SSH 进飞牛
ssh admin@飞牛IP

# 进入项目目录
cd /vol1/1000/docker/novelcraft

# 查看服务状态
docker compose ps

# 查看日志（实时）
docker compose logs -f backend

# 重启某个服务
docker compose restart backend

# 停止所有服务
docker compose stop

# 启动所有服务
docker compose start

# 完全删除（保留数据）
docker compose down

# 完全删除（同时清数据）
docker compose down -v

# 查看资源占用
docker stats

# 进入容器内部调试
docker compose exec backend sh
docker compose exec db psql -U novelcraft novelcraft
```
