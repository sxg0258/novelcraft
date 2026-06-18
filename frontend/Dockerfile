FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/
RUN npm install --omit=dev
RUN npx prisma generate

COPY . .

RUN addgroup -g 1000 nc && adduser -u 1000 -G nc -D nc
RUN mkdir -p /app/files && chown -R nc:nc /app
USER nc

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
