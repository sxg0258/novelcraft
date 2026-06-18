// NovelCraft backend entry
// Fastify + Prisma + PostgreSQL
// 路由拆分在 src/routes/

import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { prisma } from './db.js'

import { extractPlainText, countWords, asyncRoute } from './utils.js'
import { recordSnapshot, getTotalWords } from './snapshots.js'
import characterRoutes from './routes/characters.js'
import worldItemRoutes from './routes/world-items.js'
import customFieldRoutes from './routes/custom-fields.js'
import outlineRoutes from './routes/outlines.js'
import aiStyleRoutes from './routes/ai-styles.js'
import exportRoutes from './routes/export.js'
import aiRoutes from './routes/ai.js'
import authRoutes from './routes/auth.js'
import miscRoutes from './routes/misc.js'

const app = Fastify({
  logger: {
    transport: process.env.NODE_ENV === 'production' ? undefined : {
      target: 'pino-pretty',
      options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' }
    }
  },
  bodyLimit: 10 * 1024 * 1024
})

await app.register(cors, { origin: true, credentials: true })
await app.register(jwt, {
  secret: process.env.JWT_SECRET || 'dev-secret-change-me',
  sign: { expiresIn: '7d' }
})

// 把 prisma 注入到每个路由
app.decorate('prisma', prisma)

// ===== 健康检查 =====
app.get('/health', async () => ({
  status: 'ok',
  version: '0.2.0',
  timestamp: new Date().toISOString()
}))

// ===== 认证（MVP 阶段占位）=====
app.post('/api/auth/register', async (req, reply) => {
  reply.code(501); return { error: 'not_implemented_yet' }
})
app.post('/api/auth/login', async (req, reply) => {
  reply.code(501); return { error: 'not_implemented_yet' }
})

// ===== 书籍 CRUD =====
app.get('/api/books', asyncRoute(async () => {
  const books = await prisma.book.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { chapters: true } } }
  })
  return { books }
}))

app.post('/api/books', asyncRoute(async (req, reply) => {
  const { title, summary, coverUrl } = req.body || {}
  if (!title) { reply.code(400); return { error: 'title_required' } }
  const book = await prisma.book.create({
    data: {
      title: String(title).trim().slice(0, 200),
      summary: summary ? String(summary).slice(0, 2000) : null,
      coverUrl: coverUrl || null
    }
  })
  reply.code(201); return { book }
}))

app.get('/api/books/:id', asyncRoute(async (req, reply) => {
  const book = await prisma.book.findUnique({
    where: { id: req.params.id },
    include: {
      chapters: {
        orderBy: { position: 'asc' },
        select: { id: true, title: true, parentId: true, wordCount: true, position: true, updatedAt: true }
      }
    }
  })
  if (!book) { reply.code(404); return { error: 'book_not_found' } }
  return { book }
}))

app.patch('/api/books/:id', asyncRoute(async (req, reply) => {
  const { title, summary, coverUrl, status } = req.body || {}
  const data = {}
  if (title !== undefined) data.title = String(title).slice(0, 200)
  if (summary !== undefined) data.summary = summary ? String(summary).slice(0, 2000) : null
  if (coverUrl !== undefined) data.coverUrl = coverUrl || null
  if (status !== undefined) data.status = String(status)
  try {
    const book = await prisma.book.update({ where: { id: req.params.id }, data })
    return { book }
  } catch (e) {
    if (e.code === 'P2025') { reply.code(404); return { error: 'book_not_found' } }
    throw e
  }
}))

app.delete('/api/books/:id', asyncRoute(async (req, reply) => {
  try {
    await prisma.book.delete({ where: { id: req.params.id } })
    return { ok: true }
  } catch (e) {
    if (e.code === 'P2025') { reply.code(404); return { error: 'book_not_found' } }
    throw e
  }
}))

// ===== 章节 CRUD =====
app.post('/api/books/:bookId/chapters', asyncRoute(async (req, reply) => {
  const { bookId } = req.params
  const { title, parentId, content } = req.body || {}
  if (!title) { reply.code(400); return { error: 'title_required' } }
  const last = await prisma.chapter.findFirst({
    where: { bookId, parentId: parentId || null },
    orderBy: { position: 'desc' }
  })
  const position = (last?.position ?? -1) + 1
  const contentText = extractPlainText(content)
  try {
    const chapter = await prisma.chapter.create({
      data: {
        bookId,
        parentId: parentId || null,
        title: String(title).slice(0, 200),
        content: content || { type: 'doc', content: [] },
        contentText,
        wordCount: countWords(contentText),
        position
      }
    })
    reply.code(201); return { chapter }
  } catch (e) {
    if (e.code === 'P2003') { reply.code(404); return { error: 'book_not_found' } }
    throw e
  }
}))

app.patch('/api/chapters/:id', asyncRoute(async (req, reply) => {
  const { title, content } = req.body || {}
  const data = {}
  if (title !== undefined) data.title = String(title).slice(0, 200)
  if (content !== undefined) {
    const contentText = extractPlainText(content)
    data.content = content
    data.contentText = contentText
    data.wordCount = countWords(contentText)
  }
  try {
    const chapter = await prisma.chapter.update({ where: { id: req.params.id }, data })
    // 更新今日字数快照（异步，不阻塞响应）
    if (content !== undefined) {
      getTotalWords(chapter.bookId).then(total => recordSnapshot(chapter.bookId, total)).catch(() => {})
      // 自动章节快照：每 10 分钟最多一张
      shouldTakeSnapshot(prisma, chapter.id, chapter.contentText).catch(() => {})
    }
    return { chapter }
  } catch (e) {
    if (e.code === 'P2025') { reply.code(404); return { error: 'chapter_not_found' } }
    throw e
  }
}))

app.delete('/api/chapters/:id', asyncRoute(async (req, reply) => {
  try {
    const ch = await prisma.chapter.findUnique({ where: { id: req.params.id } })
    await prisma.chapter.delete({ where: { id: req.params.id } })
    // 删章节后更新快照
    if (ch) {
      getTotalWords(ch.bookId).then(total => recordSnapshot(ch.bookId, total)).catch(() => {})
    }
    return { ok: true }
  } catch (e) {
    if (e.code === 'P2025') { reply.code(404); return { error: 'chapter_not_found' } }
    throw e
  }
}))

/**
 * 自动章节快照：距离上次快照超过 10 分钟且字数变化超过 50 字则拍一张
 */
async function shouldTakeSnapshot(prisma, chapterId, currentText) {
  const last = await prisma.chapterSnapshot.findFirst({
    where: { chapterId },
    orderBy: { createdAt: 'desc' }
  })
  if (last) {
    const elapsed = Date.now() - new Date(last.createdAt).getTime()
    if (elapsed < 10 * 60 * 1000) return // 不到 10 分钟
    const lenDelta = Math.abs((currentText?.length || 0) - (last.contentText?.length || 0))
    if (lenDelta < 50) return // 字数变化太小
  }
  const ch = await prisma.chapter.findUnique({ where: { id: chapterId } })
  if (!ch) return
  await prisma.chapterSnapshot.create({
    data: {
      chapterId,
      title: ch.title,
      content: ch.content,
      contentText: ch.contentText,
      wordCount: ch.wordCount
    }
  })
  // 保留最新 20 张
  const all = await prisma.chapterSnapshot.findMany({
    where: { chapterId },
    orderBy: { createdAt: 'desc' },
    select: { id: true }
  })
  if (all.length > 20) {
    const toDelete = all.slice(20).map(s => s.id)
    await prisma.chapterSnapshot.deleteMany({ where: { id: { in: toDelete } } })
  }
}

// ===== 子路由注册 =====
await characterRoutes(app, { prisma })
await worldItemRoutes(app, { prisma })
await customFieldRoutes(app, { prisma })
await outlineRoutes(app, { prisma })
await aiStyleRoutes(app, { prisma })
await exportRoutes(app, { prisma })
await aiRoutes(app, { prisma })
await authRoutes(app, { prisma })
await miscRoutes(app, { prisma })

// ===== 启动 =====
const PORT = Number(process.env.PORT) || 3000
const HOST = process.env.HOST || '0.0.0.0'

try {
  await app.listen({ port: PORT, host: HOST })
  app.log.info(`NovelCraft backend ready on http://${HOST}:${PORT}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}

const shutdown = async () => {
  app.log.info('Shutting down...')
  await app.close()
  await prisma.$disconnect()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
