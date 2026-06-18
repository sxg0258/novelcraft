// 统一 AI 网关
// 设计原则：
// 1. 所有外部 provider 都封装成 OpenAI Chat Completions 协议（最通用）
// 2. 流式响应统一为 SSE 格式
// 3. 错误统一处理，API key 缺失时给友好提示
// 4. provider 列表运行时配置，存数据库（用户自管理）

const PROVIDER_DEFAULTS = {
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-preview', 'o1-mini'],
    keyFormat: 'sk-...'
  },
  anthropic: {
    label: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-20241022',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    keyFormat: 'sk-ant-...',
    note: '需要走消息格式转换（见 convertToAnthropic）'
  },
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    keyFormat: 'sk-...'
  },
  qwen: {
    label: '通义千问（DashScope）',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-long'],
    keyFormat: 'sk-...'
  },
  glm: {
    label: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-plus',
    models: ['glm-4-plus', 'glm-4-air', 'glm-4-flash'],
    keyFormat: '...'
  },
  ollama: {
    label: 'Ollama（本地）',
    baseUrl: 'http://ollama:11434/v1',
    defaultModel: 'qwen2.5:7b',
    models: [], // Ollama 模型由本地拉取决定
    keyFormat: '（无需 API key）',
    note: '需启用 ai-local profile'
  },
  custom: {
    label: '自定义（OpenAI 兼容）',
    baseUrl: '',
    defaultModel: '',
    models: [],
    keyFormat: '可选'
  }
}

/**
 * 列出所有支持的 provider 元数据（用于前端下拉）
 */
export function listProviders() {
  return Object.entries(PROVIDER_DEFAULTS).map(([key, info]) => ({
    key,
    ...info
  }))
}

/**
 * 调用大模型（流式）
 * @param {Object} config - { provider, baseUrl, apiKey, model }
 * @param {Array} messages - [{role: 'system'|'user'|'assistant', content: '...'}]
 * @param {Object} options - { temperature, topP, frequencyPenalty, presencePenalty, maxTokens, signal }
 * @returns {AsyncIterable<string>} 流式文本片段
 */
export async function* streamChat(config, messages, options = {}) {
  const { provider, baseUrl, apiKey, model } = config
  const meta = PROVIDER_DEFAULTS[provider]
  if (!meta) throw new Error(`unknown_provider: ${provider}`)

  const url = buildChatUrl(provider, baseUrl || meta.baseUrl, model)

  const headers = buildHeaders(provider, apiKey)
  const body = buildRequestBody(provider, model, messages, options)

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: options.signal
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`${provider} API error ${res.status}: ${errText.slice(0, 500)}`)
  }

  // Anthropic 不走 SSE，需要特殊处理
  if (provider === 'anthropic') {
    yield* streamAnthropic(res, options.signal)
    return
  }

  // OpenAI 兼容协议：SSE 流
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') return
        try {
          const json = JSON.parse(payload)
          const delta = json.choices?.[0]?.delta?.content
          if (delta) yield delta
        } catch (e) {
          // 忽略无法解析的行
        }
      }
    }
  } finally {
    try { reader.releaseLock() } catch (e) {}
  }
}

/**
 * 非流式调用（用于不需要流式的场景，比如嵌入向量）
 */
export async function chat(config, messages, options = {}) {
  const chunks = []
  for await (const chunk of streamChat(config, messages, options)) {
    chunks.push(chunk)
  }
  return chunks.join('')
}

// ===== 各 provider 适配 =====

function buildChatUrl(provider, baseUrl, model) {
  if (provider === 'anthropic') {
    return `${baseUrl.replace(/\/$/, '')}/messages`
  }
  // OpenAI 兼容：/chat/completions
  return `${baseUrl.replace(/\/$/, '')}/chat/completions`
}

function buildHeaders(provider, apiKey) {
  if (provider === 'anthropic') {
    return {
      'Content-Type': 'application/json',
      'x-api-key': apiKey || '',
      'anthropic-version': '2023-06-01'
    }
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey || 'ollama'}`
  }
}

function buildRequestBody(provider, model, messages, options) {
  const {
    temperature = 0.7,
    topP = 1.0,
    frequencyPenalty = 0,
    presencePenalty = 0,
    maxTokens = 2048
  } = options

  if (provider === 'anthropic') {
    // Anthropic Messages API
    const systemMsg = messages.find(m => m.role === 'system')
    const otherMsgs = messages.filter(m => m.role !== 'system')
    return {
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemMsg?.content || undefined,
      messages: otherMsgs.map(m => ({ role: m.role, content: m.content })),
      stream: true
    }
  }

  return {
    model,
    messages,
    temperature,
    top_p: topP,
    frequency_penalty: frequencyPenalty,
    presence_penalty: presencePenalty,
    max_tokens: maxTokens,
    stream: true
  }
}

async function* streamAnthropic(res, signal) {
  // Anthropic SSE 格式与 OpenAI 不同，需要转换
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      if (signal?.aborted) break
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') return
        try {
          const json = JSON.parse(payload)
          if (json.type === 'content_block_delta' && json.delta?.text) {
            yield json.delta.text
          }
        } catch (e) {}
      }
    }
  } finally {
    try { reader.releaseLock() } catch (e) {}
  }
}

/**
 * 测试 provider 连通性
 */
export async function testProvider(config) {
  try {
    const text = await chat(config, [
      { role: 'user', content: '回复"OK"即可' }
    ], { maxTokens: 10, temperature: 0 })
    return { ok: true, response: text }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

/**
 * 列出 Ollama 本地已下载的模型
 */
export async function listOllamaModels(baseUrl = 'http://ollama:11434') {
  try {
    const res = await fetch(`${baseUrl}/api/tags`)
    if (!res.ok) throw new Error(`ollama HTTP ${res.status}`)
    const json = await res.json()
    return (json.models || []).map(m => m.name)
  } catch (e) {
    throw new Error(`无法连接 Ollama (${baseUrl}): ${e.message}`)
  }
}
