# NovelCraft — 飞牛 NAS 一键部署文件

把以下 4 个文件上传到 `/vol1/1000/docker/novelcraft/` 后 SSH 执行 `docker compose up -d`。

## 1. docker-compose.yml

```yaml
version: '3.9'

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
      - "5210:80"
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

  # 可选：本地 AI（按需启用：docker compose --profile ai-local up -d ollama）
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
```

## 2. .env

```bash
DB_PASSWORD=NovelCraft@2026_ChangeMe
JWT_SECRET=please_change_to_a_long_random_string_at_least_32_chars
DATA_PATH=/vol1/1000/docker/novelcraft
TZ=Asia/Shanghai
```

> 首次启动后请修改 `DB_PASSWORD` 和 `JWT_SECRET`！

## 3. backend/Dockerfile

见 `backend/Dockerfile`（仓库根）。

## 4. frontend/Dockerfile

见 `frontend/Dockerfile`（仓库根）。
