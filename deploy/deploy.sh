#!/bin/bash
# NovelCraft 飞牛 NAS 一键部署脚本
# 用法：
#   方式 1：环境变量指定镜像仓库
#     GHCR_USER=你的github用户名 bash deploy.sh
#   方式 2：编辑下面的 GHCR_USER 默认值
#
# 部署位置：/vol1/1000/docker/novelcraft
# 端口：5210

set -e

# ===== 配置 =====
GHCR_USER="${GHCR_USER:-你的github用户名}"   # ← 改成你的 GitHub 用户名！
IMAGE_TAG="${IMAGE_TAG:-latest}"
INSTALL_DIR="/vol1/1000/docker/novelcraft"

# ===== 颜色 =====
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ===== 前置检查 =====
[ "$EUID" -ne 0 ] && err "请用 root 运行：sudo -i 后再跑这个脚本"
[ -z "$(command -v docker)" ] && err "没找到 docker，请先在飞牛应用中心装 Docker"
[ "$GHCR_USER" = "你的github用户名" ] && err "请先设置 GHCR_USER 环境变量，或编辑脚本顶部 GHCR_USER"

# ===== 1. 创建目录结构 =====
info "创建目录结构..."
mkdir -p "$INSTALL_DIR/data"/{postgres,redis,files}
mkdir -p "$INSTALL_DIR/backups"

# ===== 2. 生成环境变量（首次）=====
if [ ! -f "$INSTALL_DIR/.env" ]; then
  info "生成 .env（首次部署）..."
  cat > "$INSTALL_DIR/.env" <<EOF
# ⚠️ 部署完成后请修改为强密码！
DB_PASSWORD=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -hex 32)
DATA_PATH=$INSTALL_DIR
TZ=Asia/Shanghai
EOF
  warn "已生成随机密码，查看：cat $INSTALL_DIR/.env"
fi

# ===== 3. 生成 docker-compose.yml（GHCR 版）=====
info "生成 docker-compose.yml..."
cat > "$INSTALL_DIR/docker-compose.yml" <<EOF
# NovelCraft - 由 GitHub Actions 自动构建 + 推送
# 镜像源：ghcr.io/$GHCR_USER/novelcraft-{backend,frontend}:$IMAGE_TAG

version: '3.9'

networks:
  novelcraft:
    driver: bridge
    ipam:
      config:
        - subnet: 172.30.0.0/24

services:
  frontend:
    image: ghcr.io/$GHCR_USER/novelcraft-frontend:$IMAGE_TAG
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
    image: ghcr.io/$GHCR_USER/novelcraft-backend:$IMAGE_TAG
    container_name: novelcraft-backend
    restart: unless-stopped
    environment:
      DATABASE_URL: postgres://novelcraft:\${DB_PASSWORD}@db:5432/novelcraft
      REDIS_URL: redis://redis:6379
      JWT_SECRET: \${JWT_SECRET}
      NODE_OPTIONS: "--max-old-space-size=512"
      TZ: Asia/Shanghai
    depends_on:
      - db
      - redis
    volumes:
      - \${DATA_PATH}/files:/app/files
    networks:
      novelcraft:
        ipv4_address: 172.30.0.20

  db:
    image: postgres:15-alpine
    container_name: novelcraft-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: novelcraft
      POSTGRES_PASSWORD: \${DB_PASSWORD}
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
      - \${DATA_PATH}/postgres:/var/lib/postgresql/data
    networks:
      novelcraft:
        ipv4_address: 172.30.0.30

  redis:
    image: redis:7-alpine
    container_name: novelcraft-redis
    restart: unless-stopped
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - \${DATA_PATH}/redis:/data
    networks:
      novelcraft:
        ipv4_address: 172.30.0.40

  ollama:
    image: ollama/ollama:latest
    container_name: novelcraft-ollama
    profiles: ["ai-local"]
    restart: unless-stopped
    volumes:
      - \${DATA_PATH}/ollama:/root/.ollama
    ports:
      - "11434:11434"
    networks:
      novelcraft:
        ipv4_address: 172.30.0.50
EOF

# ===== 4. 登录 GHCR（私有包必须登录，公开包免登录但登录更快）=====
info "登录 GHCR（拉取镜像）..."
echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin 2>/dev/null || \
  warn "未提供 GITHUB_TOKEN（公开镜像可忽略此警告）"

# ===== 5. 拉镜像 + 启动 =====
cd "$INSTALL_DIR"
info "拉取最新镜像..."
docker compose pull

info "启动服务..."
docker compose up -d

# ===== 6. 等待启动 =====
info "等待后端就绪..."
for i in {1..30}; do
  if docker compose exec -T backend wget -q -O - http://localhost:3000/health 2>/dev/null | grep -q "ok"; then
    info "后端启动成功！"
    break
  fi
  sleep 2
done

# ===== 7. 显示状态 =====
echo ""
info "=== 部署完成 ==="
echo ""
docker compose ps
echo ""
echo "📍 访问地址：http://$(hostname -I | awk '{print $1}'):5210"
echo ""
echo "📝 第一次访问需要注册账号，第一个注册的用户自动成为管理员"
echo ""
echo "🔧 常用命令："
echo "  查看日志：cd $INSTALL_DIR && docker compose logs -f backend"
echo "  重启服务：cd $INSTALL_DIR && docker compose restart"
echo "  停服务  ：cd $INSTALL_DIR && docker compose stop"
echo "  升级版本：cd $INSTALL_DIR && docker compose pull && docker compose up -d"
echo ""
echo "💾 自动备份（建议加到 crontab）："
echo "  0 3 * * * cd $INSTALL_DIR && docker compose exec -T db pg_dump -U novelcraft novelcraft > $INSTALL_DIR/backups/db_\$(date +\\%Y\\%m\\%d).sql"
echo ""
warn "⚠️  首次部署后请修改密码：nano $INSTALL_DIR/.env 然后 docker compose restart backend"
