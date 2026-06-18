# syntax=docker/dockerfile:1.7
# 多架构支持：linux/amd64 + linux/arm64
# 由 GitHub Actions 自动构建并推送到 GHCR

# ---- 依赖缓存阶段 ----
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --include=dev
RUN npx prisma generate

# ---- 构建阶段 ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .

# ---- 生产阶段 ----
FROM node:20-alpine AS runtime
WORKDIR /app

# OCI 标准元数据（用于 GHCR 显示）
LABEL org.opencontainers.image.title="NovelCraft Backend"
LABEL org.opencontainers.image.description="Fastify + Prisma + PostgreSQL backend for NovelCraft"
LABEL org.opencontainers.image.source="https://github.com/novelcraft/novelcraft"
LABEL org.opencontainers.image.licenses="MIT"

# 系统依赖
RUN apk add --no-cache openssl dumb-init \
    && addgroup -g 1000 novelcraft \
    && adduser -u 1000 -G novelcraft -D novelcraft

# 只装生产依赖
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev && npx prisma generate && npm cache clean --force

# 拷源码
COPY --from=builder /app/src ./src

# 上传目录
RUN mkdir -p /app/files && chown -R novelcraft:novelcraft /app
USER novelcraft

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# 用 dumb-init 正确处理信号
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
