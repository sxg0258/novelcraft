# syntax=docker/dockerfile:1.7
# 多架构：linux/amd64 + linux/arm64
# 静态文件 nginx 镜像，最终 < 30MB

# ---- 构建阶段 ----
FROM node:20-alpine AS builder
WORKDIR /app

# 关键：接受构建参数作为 base，让前端能用运行时配置（可选）
ARG VITE_API_BASE=/api

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- 运行阶段 ----
FROM nginx:1.27-alpine AS runtime
WORKDIR /usr/share/nginx/html

LABEL org.opencontainers.image.title="NovelCraft Frontend"
LABEL org.opencontainers.image.description="Vue 3 + Tiptap SPA for NovelCraft"
LABEL org.opencontainers.image.source="https://github.com/novelcraft/novelcraft"
LABEL org.opencontainers.image.licenses="MIT"

# 拷贝构建产物
COPY --from=builder /app/dist .

# PWA 静态资源（不会被打包到 dist，单独放）
COPY public/manifest.json .
COPY public/sw.js .
COPY public/icon.svg .

# Nginx 配置：SPA fallback + API 反代
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q --spider http://localhost/ || exit 1
