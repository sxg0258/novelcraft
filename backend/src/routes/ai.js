// AI Provider 配置 + 调用 API
import { asyncRoute } from '../utils.js'
import { listProviders, streamChat, chat, testProvider, listOllamaModels } from '../ai/gateway.js'
import { PROVIDER_DEFAULTS } from '../ai/gateway.js'
import { PRESET_TEMPLATES, fillTemplate } from '../ai/templates.js'

export default async function aiRoutes(app, { prisma }) {

  // ===== Provider 元数据（前端下拉用）=====
  app.get('/api/ai/providers/meta', asyncRoute(async () => ({
    providers: listProviders()
  })))

  // ===== Provider 列表 =====
  app.get('/api/ai/providers', asyncRoute(async () => {
    const providers = await prisma.aiProvider.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, provider: true, baseUrl: true, defaultModel: true, enabled: true, createdAt: true }
      // 注意：不返回 apiKey
    })
    return { providers }
  }))

  // 创建 Provider
  app.post('/api/ai/providers', asyncRoute(async (req, reply) => {
    const { name, provider, baseUrl, apiKey, defaultModel } = req.body || {}
    if (!name || !provider) { reply.code(400); return { error: 'name_and_provider_required' } }
    const meta = PROVIDER_DEFAULTS[provider]
    if (!meta) { reply.code(400); return { error: 'unknown_provider' } }
    const created = await prisma.aiProvider.create({
      data: {
        name: String(name).slice(0, 50),
        provider,
        baseUrl: baseUrl || meta.baseUrl || null,
        apiKey: apiKey || null,
        defaultModel: defaultModel || meta.defaultModel || null,
        enabled: true
      },
      select: { id: true, name: true, provider: true, baseUrl: true, defaultModel: true, enabled: true }
    })
    reply.code(201)
    return { provider: created }
  }))

  // 更新 Provider
  app.patch('/api/ai/providers/:id', asyncRoute(async (req, reply) => {
    const { name, baseUrl, apiKey, defaultModel, enabled } = req.body || {}
    const data = {}
    if (name !== undefined) data.name = String(name).slice(0, 50)
    if (baseUrl !== undefined) data.baseUrl = baseUrl || null
    if (apiKey !== undefined) data.apiKey = apiKey || null
    if (defaultModel !== undefined) data.defaultModel = defaultModel || null
    if (enabled !== undefined) data.enabled = !!enabled
    try {
      const updated = await prisma.aiProvider.update({
        where: { id: req.params.id },
        data,
        select: { id: true, name: true, provider: true, baseUrl: true, defaultModel: true, enabled: true }
      })
      return { provider: updated }
    } catch (e) {
      if (e.code === 'P2025') { reply.code(404); return { error: 'provider_not_found' } }
      throw e
    }
  }))

  // 删除 Provider
  app.delete('/api/ai/providers/:id', asyncRoute(async (req, reply) => {
    try {
      await prisma.aiProvider.delete({ where: { id: req.params.id } })
      return { ok: true }
    } catch (e) {
      if (e.code === 'P2025') { reply.code(404); return { error: 'provider_not_found' } }
      throw e
    }
  }))

  // 测试 Provider 连通性
  app.post('/api/ai/providers/:id/test', asyncRoute(async (req, reply) => {
    const p = await prisma.aiProvider.findUnique({ where: { id: req.params.id } })
    if (!p) { reply.code(404); return { error: 'provider_not_found' } }
    const result = await testProvider({
      provider: p.provider,
      baseUrl: p.baseUrl,
      apiKey: p.apiKey,
      model: req.body?.model || p.defaultModel
    })
    return result
  }))

  // Ollama 列出本地模型
  app.get('/api/ai/ollama/models', asyncRoute(async (req) => {
    const baseUrl = req.query.baseUrl || 'http://ollama:11434'
    const models = await listOllamaModels(baseUrl)
    return { models }
  }))

  // ===== 续写（流式 SSE）=====
  app.post('/api/ai/continue', {
    config: { rawBody: false }
  }, async (req, reply) => {
    const { providerId, model, context, length = 500, aiStyleId } = req.body || {}
    if (!context) { reply.code(400); return { error: 'context_required' } }

    const config = await resolveProvider(prisma, providerId)
    if (!config) { reply.code(400); return { error: 'no_provider' } }

    const style = aiStyleId ? await prisma.aiStyle.findUnique({ where: { id: aiStyleId } }) : null
    const userPrompt = fillTemplate(PRESET_TEMPLATES.continue.userPromptOnly, {
      context: context.slice(-3000),
      length: String(length)
    })
    const messages = buildMessages(style, userPrompt)

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    })

    try {
      for await (const chunk of streamChat(
        { ...config, model: model || config.defaultModel },
        messages,
        { temperature: style?.temperature ?? 0.8, topP: style?.topP ?? 1.0, maxTokens: Math.max(500, length * 2) }
      )) {
        reply.raw.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`)
      }
      reply.raw.write('data: [DONE]\n\n')
      reply.raw.end()
    } catch (e) {
      reply.raw.write(`data: ${JSON.stringify({ error: e.message })}\n\n`)
      reply.raw.end()
    }
  })

  // ===== 润色 / 扩写 / 缩写（非流式，统一返回）=====
  app.post('/api/ai/transform', asyncRoute(async (req, reply) => {
    const { mode = 'polish', providerId, model, text, length = 500, aiStyleId } = req.body || {}
    const tmpl = PRESET_TEMPLATES[mode]
    if (!tmpl) { reply.code(400); return { error: 'invalid_mode' } }
    if (!text) { reply.code(400); return { error: 'text_required' } }

    const config = await resolveProvider(prisma, providerId)
    if (!config) { reply.code(400); return { error: 'no_provider' } }

    const style = aiStyleId ? await prisma.aiStyle.findUnique({ where: { id: aiStyleId } }) : null
    const userPrompt = fillTemplate(tmpl.userPrompt || tmpl.userPromptOnly, {
      text: text.slice(0, 4000),
      length: String(length)
    })
    const messages = buildMessages(style, userPrompt)
    const result = await chat(
      { ...config, model: model || config.defaultModel },
      messages,
      { temperature: style?.temperature ?? 0.7, maxTokens: Math.max(500, text.length + length) }
    )
    return { result }
  }))

  // ===== AI 对话（带历史）=====
  // GET 历史
  app.get('/api/ai/chats', asyncRoute(async (req) => {
    const { bookId, chapterId } = req.query
    const where = { bookId }
    if (chapterId) where.chapterId = String(chapterId)
    const chats = await prisma.aiChat.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: { id: true, title: true, mode: true, chapterId: true, updatedAt: true }
    })
    return { chats }
  }))

  // 获取单条对话（含消息历史）
  app.get('/api/ai/chats/:id', asyncRoute(async (req, reply) => {
    const chat = await prisma.aiChat.findUnique({ where: { id: req.params.id } })
    if (!chat) { reply.code(404); return { error: 'chat_not_found' } }
    return { chat }
  }))

  // 新建对话（发消息）
  // 支持流式（SSE）或一次性返回
  app.post('/api/ai/chats', async (req, reply) => {
    const {
      bookId, chapterId, aiStyleId, providerId, model,
      mode = 'chat', message, stream = true, bookTitle, question, chatId
    } = req.body || {}

    if (!message && !question) {
      reply.code(400); return { error: 'message_required' }
    }

    const config = await resolveProvider(prisma, providerId)
    if (!config) {
      reply.code(400); return { error: 'no_provider' }
    }

    // 找到或创建 chat
    let chatRow
    if (chatId) {
      chatRow = await prisma.aiChat.findUnique({ where: { id: chatId } })
    }
    if (!chatRow) {
      chatRow = await prisma.aiChat.create({
        data: {
          bookId, chapterId: chapterId || null,
          aiStyleId: aiStyleId || null,
          providerId: config.id,
          model: model || config.defaultModel,
          mode,
          title: (message || question || '新对话').slice(0, 50),
          messages: []
        }
      })
    }

    const history = Array.isArray(chatRow.messages) ? chatRow.messages : []
    const style = chatRow.aiStyleId ? await prisma.aiStyle.findUnique({ where: { id: chatRow.aiStyleId } }) : null

    // 构造消息
    let userMsg
    if (mode === 'chat') {
      userMsg = fillTemplate(PRESET_TEMPLATES.chat.userPrompt, {
        bookTitle: bookTitle || '本书',
        question: message || question
      })
    } else {
      userMsg = message || question
    }

    const messages = buildMessages(style, userMsg, history)
    const newHistory = [...history, { role: 'user', content: userMsg, at: Date.now() }]

    if (!stream) {
      // 非流式
      const result = await chat(
        { ...config, model: chatRow.model },
        messages,
        {
          temperature: style?.temperature ?? 0.7,
          topP: style?.topP ?? 1.0,
          maxTokens: 2048
        }
      )
      const finalHistory = [...newHistory, { role: 'assistant', content: result, at: Date.now() }]
      await prisma.aiChat.update({
        where: { id: chatRow.id },
        data: { messages: finalHistory }
      })
      return { chatId: chatRow.id, messages: finalHistory }
    }

    // 流式 SSE
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    })

    // 先把 chatId 推给前端
    reply.raw.write(`data: ${JSON.stringify({ chatId: chatRow.id, event: 'start' })}\n\n`)

    let assistantText = ''
    try {
      for await (const chunk of streamChat(
        { ...config, model: chatRow.model },
        messages,
        {
          temperature: style?.temperature ?? 0.7,
          topP: style?.topP ?? 1.0,
          maxTokens: 2048
        }
      )) {
        assistantText += chunk
        reply.raw.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`)
      }
      const finalHistory = [...newHistory, { role: 'assistant', content: assistantText, at: Date.now() }]
      await prisma.aiChat.update({
        where: { id: chatRow.id },
        data: { messages: finalHistory }
      })
      reply.raw.write(`data: ${JSON.stringify({ event: 'done' })}\n\n`)
      reply.raw.end()
    } catch (e) {
      reply.raw.write(`data: ${JSON.stringify({ error: e.message, event: 'error' })}\n\n`)
      reply.raw.end()
    }
  })

  // 删除对话
  app.delete('/api/ai/chats/:id', asyncRoute(async (req, reply) => {
    try {
      await prisma.aiChat.delete({ where: { id: req.params.id } })
      return { ok: true }
    } catch (e) {
      if (e.code === 'P2025') { reply.code(404); return { error: 'chat_not_found' } }
      throw e
    }
  }))
}

// ===== 工具函数 =====

async function resolveProvider(prisma, providerId) {
  if (providerId) {
    const p = await prisma.aiProvider.findUnique({ where: { id: providerId } })
    if (p && p.enabled) {
      return {
        id: p.id,
        provider: p.provider,
        baseUrl: p.baseUrl,
        apiKey: p.apiKey,
        defaultModel: p.defaultModel
      }
    }
    return null
  }
  // 默认取第一个启用的
  const p = await prisma.aiProvider.findFirst({
    where: { enabled: true },
    orderBy: { createdAt: 'asc' }
  })
  if (!p) return null
  return {
    id: p.id,
    provider: p.provider,
    baseUrl: p.baseUrl,
    apiKey: p.apiKey,
    defaultModel: p.defaultModel
  }
}

function buildMessages(style, userPrompt, history = []) {
  const sysPrompt = style?.systemPrompt || '你是一位专业的小说创作助手，文笔老练，对中文网络小说和严肃文学都有深刻理解。'
  const messages = [{ role: 'system', content: sysPrompt }]
  // 截取最近 10 轮历史
  const recent = history.slice(-20)
  for (const m of recent) {
    if (m.role === 'user' || m.role === 'assistant') {
      messages.push({ role: m.role, content: m.content })
    }
  }
  messages.push({ role: 'user', content: userPrompt })
  return messages
}
