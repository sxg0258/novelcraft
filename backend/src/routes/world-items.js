// 设定卡路由（通用：地点/物品/势力/技能/其他）
import { asyncRoute } from '../utils.js'

export default async function worldItemRoutes(app, { prisma }) {

  // 列出某本书的所有设定项（可选按分类过滤）
  app.get('/api/books/:bookId/world-items', asyncRoute(async (req) => {
    const { bookId } = req.params
    const { category } = req.query
    const where = { bookId }
    if (category) where.category = String(category)
    const items = await prisma.worldItem.findMany({
      where,
      orderBy: [{ category: 'asc' }, { updatedAt: 'desc' }]
    })
    return { items }
  }))

  // 按分类聚合（用于前端分组展示）
  app.get('/api/books/:bookId/world-items/grouped', asyncRoute(async (req) => {
    const { bookId } = req.params
    const items = await prisma.worldItem.findMany({
      where: { bookId },
      orderBy: [{ category: 'asc' }, { name: 'asc' }]
    })
    const grouped = {}
    for (const item of items) {
      if (!grouped[item.category]) grouped[item.category] = []
      grouped[item.category].push(item)
    }
    return { grouped }
  }))

  // 新建设定项
  app.post('/api/books/:bookId/world-items', asyncRoute(async (req, reply) => {
    const { bookId } = req.params
    const { name, category, attributes, tags } = req.body || {}
    if (!name) { reply.code(400); return { error: 'name_required' } }
    const item = await prisma.worldItem.create({
      data: {
        bookId,
        name: String(name).slice(0, 100),
        category: category ? String(category).slice(0, 50) : 'other',
        attributes: attributes || {},
        tags: Array.isArray(tags) ? tags.slice(0, 20) : []
      }
    })
    reply.code(201)
    return { item }
  }))

  // 更新设定项
  app.patch('/api/world-items/:id', asyncRoute(async (req, reply) => {
    const { name, category, attributes, tags } = req.body || {}
    const data = {}
    if (name !== undefined) data.name = String(name).slice(0, 100)
    if (category !== undefined) data.category = String(category).slice(0, 50)
    if (attributes !== undefined) data.attributes = attributes
    if (tags !== undefined) data.tags = Array.isArray(tags) ? tags : []
    try {
      const item = await prisma.worldItem.update({ where: { id: req.params.id }, data })
      return { item }
    } catch (e) {
      if (e.code === 'P2025') { reply.code(404); return { error: 'item_not_found' } }
      throw e
    }
  }))

  // 删除设定项
  app.delete('/api/world-items/:id', asyncRoute(async (req, reply) => {
    try {
      await prisma.worldItem.delete({ where: { id: req.params.id } })
      return { ok: true }
    } catch (e) {
      if (e.code === 'P2025') { reply.code(404); return { error: 'item_not_found' } }
      throw e
    }
  }))
}
