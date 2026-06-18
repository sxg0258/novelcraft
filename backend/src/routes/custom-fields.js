// 自定义字段定义路由
// 用户可给"角色"或"设定项"加自定义字段（文本/数字/枚举/日期/URL）
import { asyncRoute } from '../utils.js'

const VALID_TYPES = ['text', 'number', 'enum', 'date', 'url']
const VALID_TARGETS = ['character', 'world_item']

export default async function customFieldRoutes(app, { prisma }) {

  // 列出某本书在某 target 下的字段定义
  app.get('/api/books/:bookId/custom-field-defs', asyncRoute(async (req) => {
    const { bookId } = req.params
    const { targetType } = req.query
    const where = { bookId }
    if (targetType && VALID_TARGETS.includes(targetType)) where.targetType = targetType
    const defs = await prisma.customFieldDef.findMany({
      where,
      orderBy: { position: 'asc' }
    })
    return { defs }
  }))

  // 新建字段定义
  app.post('/api/books/:bookId/custom-field-defs', asyncRoute(async (req, reply) => {
    const { bookId } = req.params
    const { targetType, name, fieldType, config, position } = req.body || {}
    if (!VALID_TARGETS.includes(targetType)) { reply.code(400); return { error: 'invalid_target_type' } }
    if (!name) { reply.code(400); return { error: 'name_required' } }
    if (!VALID_TYPES.includes(fieldType)) { reply.code(400); return { error: 'invalid_field_type' } }

    const def = await prisma.customFieldDef.create({
      data: {
        bookId,
        targetType,
        name: String(name).slice(0, 50),
        fieldType,
        config: fieldType === 'enum' ? { options: Array.isArray(config?.options) ? config.options : [] } : (config || {}),
        position: Number(position) || 0
      }
    })
    reply.code(201)
    return { def }
  }))

  // 更新字段定义
  app.patch('/api/custom-field-defs/:id', asyncRoute(async (req, reply) => {
    const { name, fieldType, config, position } = req.body || {}
    const data = {}
    if (name !== undefined) data.name = String(name).slice(0, 50)
    if (fieldType !== undefined && VALID_TYPES.includes(fieldType)) data.fieldType = fieldType
    if (config !== undefined) data.config = config
    if (position !== undefined) data.position = Number(position) || 0
    try {
      const def = await prisma.customFieldDef.update({ where: { id: req.params.id }, data })
      return { def }
    } catch (e) {
      if (e.code === 'P2025') { reply.code(404); return { error: 'def_not_found' } }
      throw e
    }
  }))

  // 删除字段定义
  // 注意：删定义不删数据，原 attributes 里的对应 key 保留（前端忽略即可）
  app.delete('/api/custom-field-defs/:id', asyncRoute(async (req, reply) => {
    try {
      await prisma.customFieldDef.delete({ where: { id: req.params.id } })
      return { ok: true }
    } catch (e) {
      if (e.code === 'P2025') { reply.code(404); return { error: 'def_not_found' } }
      throw e
    }
  }))
}
