// 全文搜索 + 章节快照（版本历史）+ 数据导入导出 + 协同状态
import { asyncRoute } from '../utils.js'

export default async function miscRoutes(app, { prisma }) {

  // ===== 全文搜索 =====
  // 搜索章节内容（按书过滤），返回命中片段 + 上下文
  app.get('/api/search', asyncRoute(async (req) => {
    const { q, bookId, limit = 20 } = req.query
    if (!q || String(q).trim().length === 0) return { hits: [] }

    const query = String(q).trim()
    const cap = Math.min(Number(limit) || 20, 100)

    // PostgreSQL 全文检索（simple 配置支持中英文）
    const where = {
      contentText: { contains: query }
    }
    if (bookId) where.bookId = String(bookId)

    const chapters = await prisma.chapter.findMany({
      where,
      take: cap,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, title: true, bookId: true, contentText: true,
        wordCount: true, updatedAt: true,
        book: { select: { id: true, title: true } }
      }
    })

    const hits = chapters.map(ch => {
      const text = ch.contentText || ''
      const idx = text.indexOf(query)
      let snippet = ''
      if (idx >= 0) {
        const start = Math.max(0, idx - 40)
        const end = Math.min(text.length, idx + query.length + 80)
        snippet = (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
      }
      return {
        chapterId: ch.id,
        chapterTitle: ch.title,
        bookId: ch.bookId,
        bookTitle: ch.book.title,
        snippet,
        wordCount: ch.wordCount,
        updatedAt: ch.updatedAt
      }
    })

    return { hits, query }
  }))

  // ===== 章节版本快照 =====

  // 创建快照（章节保存时可手动 / 自动触发）
  app.post('/api/chapters/:id/snapshots', asyncRoute(async (req, reply) => {
    const ch = await prisma.chapter.findUnique({ where: { id: req.params.id } })
    if (!ch) { reply.code(404); return { error: 'chapter_not_found' } }

    const snap = await prisma.chapterSnapshot.create({
      data: {
        chapterId: ch.id,
        title: ch.title,
        content: ch.content,
        contentText: ch.contentText,
        wordCount: ch.wordCount
      }
    })
    reply.code(201)
    return { snapshot: { id: snap.id, createdAt: snap.createdAt, wordCount: snap.wordCount } }
  }))

  // 列出快照（最近 20 张）
  app.get('/api/chapters/:id/snapshots', asyncRoute(async (req) => {
    const snaps = await prisma.chapterSnapshot.findMany({
      where: { chapterId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, title: true, wordCount: true, createdAt: true }
    })
    return { snapshots: snaps }
  }))

  // 获取单个快照完整内容
  app.get('/api/snapshots/:id', asyncRoute(async (req, reply) => {
    const snap = await prisma.chapterSnapshot.findUnique({ where: { id: req.params.id } })
    if (!snap) { reply.code(404); return { error: 'snapshot_not_found' } }
    return { snapshot: snap }
  }))

  // 回滚到某个快照
  app.post('/api/chapters/:id/rollback/:snapshotId', asyncRoute(async (req, reply) => {
    const snap = await prisma.chapterSnapshot.findUnique({ where: { id: req.params.snapshotId } })
    if (!snap || snap.chapterId !== req.params.id) {
      reply.code(404); return { error: 'snapshot_not_found' }
    }
    const chapter = await prisma.chapter.update({
      where: { id: req.params.id },
      data: {
        title: snap.title,
        content: snap.content,
        contentText: snap.contentText,
        wordCount: snap.wordCount
      }
    })
    return { chapter }
  }))

  // diff 两个快照（朴素 diff：分段对比，返回新增/删除段落）
  app.get('/api/chapters/:id/diff', asyncRoute(async (req, reply) => {
    const { from, to } = req.query
    if (!from || !to) { reply.code(400); return { error: 'from_and_to_required' } }

    const [snapA, snapB] = await Promise.all([
      prisma.chapterSnapshot.findUnique({ where: { id: String(from) } }),
      prisma.chapterSnapshot.findUnique({ where: { id: String(to) } })
    ])
    if (!snapA || !snapB || snapA.chapterId !== req.params.id || snapB.chapterId !== req.params.id) {
      reply.code(404); return { error: 'snapshot_not_found' }
    }

    // 朴素段落 diff（按 \n\n 分段）
    const a = (snapA.contentText || '').split(/\n+/).filter(s => s.trim())
    const b = (snapB.contentText || '').split(/\n+/).filter(s => s.trim())
    const aSet = new Set(a)
    const bSet = new Set(b)
    const added = b.filter(p => !aSet.has(p))
    const removed = a.filter(p => !bSet.has(p))

    return {
      from: { id: snapA.id, createdAt: snapA.createdAt, wordCount: snapA.wordCount },
      to: { id: snapB.id, createdAt: snapB.createdAt, wordCount: snapB.wordCount },
      wordDelta: snapB.wordCount - snapA.wordCount,
      added,
      removed
    }
  }))

  // ===== 数据导入导出 =====

  // 导出全部数据为 JSON
  app.get('/api/backup/export', asyncRoute(async (req, reply) => {
    const data = {
      version: '0.4.0',
      exportedAt: new Date().toISOString(),
      books: [],
      characters: [],
      worldItems: [],
      customFieldDefs: [],
      outlines: [],
      aiStyles: [],
      aiChats: [],
      chapters: []
    }

    const books = await prisma.book.findMany({
      include: {
        chapters: { select: { id: true, parentId: true, title: true, content: true, contentText: true, wordCount: true, position: true, createdAt: true, updatedAt: true } },
        characters: true,
        worldItems: true,
        customFieldDefs: true,
        outlines: true,
        aiStyles: true,
        aiChats: true
      }
    })

    for (const book of books) {
      data.books.push({
        id: book.id, title: book.title, summary: book.summary, status: book.status,
        coverUrl: book.coverUrl, createdAt: book.createdAt, updatedAt: book.updatedAt
      })
      data.chapters.push(...book.chapters.map(c => ({ ...c, bookId: book.id })))
      data.characters.push(...book.characters.map(c => ({ ...c, bookId: book.id })))
      data.worldItems.push(...book.worldItems.map(c => ({ ...c, bookId: book.id })))
      data.customFieldDefs.push(...book.customFieldDefs.map(c => ({ ...c, bookId: book.id })))
      data.outlines.push(...book.outlines.map(c => ({ ...c, bookId: book.id })))
      data.aiStyles.push(...book.aiStyles.map(c => ({ ...c, bookId: book.id })))
      data.aiChats.push(...book.aiChats.map(c => ({ ...c, bookId: book.id })))
    }

    const json = JSON.stringify(data, null, 2)
    const filename = `novelcraft-backup-${new Date().toISOString().slice(0, 10)}.json`
    reply.header('Content-Type', 'application/json; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename="${filename}"`)
    return json
  }))

  // 导入 JSON 备份
  app.post('/api/backup/import', asyncRoute(async (req, reply) => {
    const { data, mode = 'merge' } = req.body || {}
    if (!data || !data.version) { reply.code(400); return { error: 'invalid_backup' } }
    if (!['merge', 'replace'].includes(mode)) { reply.code(400); return { error: 'invalid_mode' } }

    if (mode === 'replace') {
      // 清空所有数据（危险操作）
      await prisma.$transaction([
        prisma.chapterSnapshot.deleteMany(),
        prisma.aiChat.deleteMany(),
        prisma.aiStyle.deleteMany(),
        prisma.outline.deleteMany(),
        prisma.customFieldDef.deleteMany(),
        prisma.worldItem.deleteMany(),
        prisma.character.deleteMany(),
        prisma.chapter.deleteMany(),
        prisma.book.deleteMany()
      ])
    }

    let stats = { books: 0, chapters: 0, characters: 0, worldItems: 0, outlines: 0 }
    for (const book of (data.books || [])) {
      const { id, ...rest } = book
      const created = await prisma.book.create({ data: rest })
      stats.books++
      const bookId = created.id

      for (const ch of (data.chapters || []).filter(c => c.bookId === id)) {
        const { id: cid, bookId: _, ...chRest } = ch
        await prisma.chapter.create({ data: { ...chRest, bookId } })
        stats.chapters++
      }
      for (const c of (data.characters || []).filter(c => c.bookId === id)) {
        const { id: cid, bookId: _, ...cRest } = c
        await prisma.character.create({ data: { ...cRest, bookId } })
        stats.characters++
      }
      for (const w of (data.worldItems || []).filter(c => c.bookId === id)) {
        const { id: wid, bookId: _, ...wRest } = w
        await prisma.worldItem.create({ data: { ...wRest, bookId } })
        stats.worldItems++
      }
      for (const o of (data.outlines || []).filter(c => c.bookId === id)) {
        const { id: oid, bookId: _, ...oRest } = o
        await prisma.outline.create({ data: { ...oRest, bookId } })
        stats.outlines++
      }
      // 自定义字段、AI 风格、AI 对话也类似处理（MVP 阶段先简化）
    }

    return { ok: true, stats }
  }))

  // ===== 协同状态（MVP：保存二进制 Yjs 文档，按需扩展 WebSocket）=====

  app.get('/api/collab/:chapterId', asyncRoute(async (req, reply) => {
    const state = await prisma.collabState.findUnique({
      where: { chapterId: req.params.chapterId },
      select: { state: true, updatedAt: true }
    })
    if (!state) return { state: null }
    // state.state 是 Buffer，转 base64
    return {
      state: state.state.toString('base64'),
      updatedAt: state.updatedAt
    }
  }))

  app.put('/api/collab/:chapterId', asyncRoute(async (req, reply) => {
    const { state } = req.body || {} // base64 string
    if (!state) { reply.code(400); return { error: 'state_required' } }
    const buf = Buffer.from(state, 'base64')
    await prisma.collabState.upsert({
      where: { chapterId: req.params.chapterId },
      update: { state: buf },
      create: { chapterId: req.params.chapterId, state: buf }
    })
    return { ok: true }
  }))
}
