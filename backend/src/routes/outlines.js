// 大纲节点路由
// 树形结构：起因/经过/结果，或自由层级
import { asyncRoute } from '../utils.js'

export default async function outlineRoutes(app, { prisma }) {

  // 列出某本书的大纲（树形）
  app.get('/api/books/:bookId/outlines', asyncRoute(async (req) => {
    const { bookId } = req.params
    const outlines = await prisma.outline.findMany({
      where: { bookId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
    })
    // 转树形
    const map = new Map()
    outlines.forEach(o => map.set(o.id, { ...o, children: [] }))
    const roots = []
    for (const o of map.values()) {
      if (o.parentId && map.has(o.parentId)) {
        map.get(o.parentId).children.push(o)
      } else {
        roots.push(o)
      }
    }
    return { outlines: roots }
  }))

  // 新建大纲节点
  app.post('/api/books/:bookId/outlines', asyncRoute(async (req, reply) => {
    const { bookId } = req.params
    const { title, content, parentId, position } = req.body || {}
    if (!title) { reply.code(400); return { error: 'title_required' } }
    // 自动 position
    let pos = position
    if (pos === undefined) {
      const last = await prisma.outline.findFirst({
        where: { bookId, parentId: parentId || null },
        orderBy: { position: 'desc' }
      })
      pos = (last?.position ?? -1) + 1
    }
    const outline = await prisma.outline.create({
      data: {
        bookId,
        title: String(title).slice(0, 200),
        content: content || null,
        parentId: parentId || null,
        position: Number(pos) || 0
      }
    })
    reply.code(201)
    return { outline }
  }))

  // 更新大纲节点
  app.patch('/api/outlines/:id', asyncRoute(async (req, reply) => {
    const { title, content, position } = req.body || {}
    const data = {}
    if (title !== undefined) data.title = String(title).slice(0, 200)
    if (content !== undefined) data.content = content || null
    if (position !== undefined) data.position = Number(position) || 0
    try {
      const outline = await prisma.outline.update({ where: { id: req.params.id }, data })
      return { outline }
    } catch (e) {
      if (e.code === 'P2025') { reply.code(404); return { error: 'outline_not_found' } }
      throw e
    }
  }))

  // 删除大纲节点（级联删子节点）
  app.delete('/api/outlines/:id', asyncRoute(async (req, reply) => {
    try {
      await prisma.outline.delete({ where: { id: req.params.id } })
      return { ok: true }
    } catch (e) {
      if (e.code === 'P2025') { reply.code(404); return { error: 'outline_not_found' } }
      throw e
    }
  }))
}
