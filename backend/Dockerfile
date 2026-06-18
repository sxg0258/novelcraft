# NovelCraft Backend Dockerfile (极简版)
# 目标：能在 GitHub Actions 上一次跑通

FROM node:20-alpine
WORKDIR /app

# 系统依赖（apk update 是 Alpine 必需）
RUN apk add --no-cache openssl

# 先装 npm 依赖
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install --omit=dev
RUN npx prisma generate

# 拷源码
COPY . .

# 创建用户组和用户（-S 用 system account，-s 指定 shell）
RUN addgroup -g 1000 nc && \
    adduser -u 1000 -G nc -s /bin/sh -D nc

# 创建文件目录并设置权限
RUN mkdir -p /app/files && \
    chown -R nc:nc /app

# 切到非 root 用户
USER nc

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
