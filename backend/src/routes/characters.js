// 角色卡路由
import { asyncRoute } from '../utils.js'

export default async function characterRoutes(app, { prisma }) {

  // 列出某本书的所有角色
  app.get('/api/books/:bookId/characters', asyncRoute(async (req, reply) => {
    const { bookId } = req.params
    const characters = await prisma.character.findMany({
      where: { bookId },
      orderBy: { updatedAt: 'desc' }
    })
    return { characters }
  }))

  // 获取单个角色
  app.get('/api/characters/:id', asyncRoute(async (req, reply) => {
    const char = await prisma.character.findUnique({ where: { id: req.params.id } })
    if (!char) { reply.code(404); return { error: 'character_not_found' } }
    return { character: char }
  }))

  // 新建角色
  app.post('/api/books/:bookId/characters', asyncRoute(async (req, reply) => {
    const { bookId } = req.params
    const { name, avatarUrl, attributes, relations } = req.body || {}
    if (!name || typeof name !== 'string') {
      reply.code(400); return { error: 'name_required' }
    }
    const character = await prisma.character.create({
      data: {
        bookId,
        name: name.trim().slice(0, 100),
        avatarUrl: avatarUrl || null,
        attributes: attributes || {},
        relations: relations || []
      }
    })
    reply.code(201)
    return { character }
  }))

  // 更新角色（任意字段）
  app.patch('/api/characters/:id', asyncRoute(async (req, reply) => {
    const { name, avatarUrl, attributes, relations } = req.body || {}
    const data = {}
    if (name !== undefined) data.name = String(name).slice(0, 100)
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl || null
    if (attributes !== undefined) data.attributes = attributes
    if (relations !== undefined) data.relations = relations

    try {
      const character = await prisma.character.update({
        where: { id: req.params.id },
        data
      })
      return { character }
    } catch (e) {
      if (e.code === 'P2025') { reply.code(404); return { error: 'character_not_found' } }
      throw e
    }
  }))

  // 删除角色
  app.delete('/api/characters/:id', asyncRoute(async (req, reply) => {
    try {
      await prisma.character.delete({ where: { id: req.params.id } })
      return { ok: true }
    } catch (e) {
      if (e.code === 'P2025') { reply.code(404); return { error: 'character_not_found' } }
      throw e
    }
  }))
}
