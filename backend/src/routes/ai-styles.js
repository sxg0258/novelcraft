// AI 风格预设路由
import { asyncRoute } from '../utils.js'

export default async function aiStyleRoutes(app, { prisma }) {

  app.get('/api/books/:bookId/ai-styles', asyncRoute(async (req) => {
    const styles = await prisma.aiStyle.findMany({
      where: { bookId: req.params.bookId },
      orderBy: { createdAt: 'asc' }
    })
    return { styles }
  }))

  app.post('/api/books/:bookId/ai-styles', asyncRoute(async (req, reply) => {
    const { bookId } = req.params
    const { name, description, systemPrompt, temperature, topP, frequencyPenalty, presencePenalty, isDefault } = req.body || {}
    if (!name) { reply.code(400); return { error: 'name_required' } }
    // 默认值
    const data = {
      bookId,
      name: String(name).slice(0, 100),
      description: description || null,
      systemPrompt: systemPrompt || null,
      temperature: clamp(temperature, 0, 2, 0.7),
      topP: clamp(topP, 0, 1, 1.0),
      frequencyPenalty: clamp(frequencyPenalty, -2, 2, 0),
      presencePenalty: clamp(presencePenalty, -2, 2, 0)
    }
    // 设为默认时，先把其他的 isDefault 清掉
    if (isDefault) {
      await prisma.aiStyle.updateMany({
        where: { bookId },
        data: { isDefault: false }
      })
      data.isDefault = true
    }
    const style = await prisma.aiStyle.create({ data })
    reply.code(201)
    return { style }
  }))

  app.patch('/api/ai-styles/:id', asyncRoute(async (req, reply) => {
    const { name, description, systemPrompt, temperature, topP, frequencyPenalty, presencePenalty, isDefault } = req.body || {}
    const data = {}
    if (name !== undefined) data.name = String(name).slice(0, 100)
    if (description !== undefined) data.description = description || null
    if (systemPrompt !== undefined) data.systemPrompt = systemPrompt || null
    if (temperature !== undefined) data.temperature = clamp(temperature, 0, 2, 0.7)
    if (topP !== undefined) data.topP = clamp(topP, 0, 1, 1.0)
    if (frequencyPenalty !== undefined) data.frequencyPenalty = clamp(frequencyPenalty, -2, 2, 0)
    if (presencePenalty !== undefined) data.presencePenalty = clamp(presencePenalty, -2, 2, 0)
    if (isDefault === true) {
      // 找到当前 style 所属书
      const cur = await prisma.aiStyle.findUnique({ where: { id: req.params.id } })
      if (cur) {
        await prisma.aiStyle.updateMany({
          where: { bookId: cur.bookId },
          data: { isDefault: false }
        })
        data.isDefault = true
      }
    } else if (isDefault === false) {
      data.isDefault = false
    }
    try {
      const style = await prisma.aiStyle.update({ where: { id: req.params.id }, data })
      return { style }
    } catch (e) {
      if (e.code === 'P2025') { reply.code(404); return { error: 'style_not_found' } }
      throw e
    }
  }))

  app.delete('/api/ai-styles/:id', asyncRoute(async (req, reply) => {
    try {
      await prisma.aiStyle.delete({ where: { id: req.params.id } })
      return { ok: true }
    } catch (e) {
      if (e.code === 'P2025') { reply.code(404); return { error: 'style_not_found' } }
      throw e
    }
  }))
}

function clamp(v, min, max, fallback) {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}
