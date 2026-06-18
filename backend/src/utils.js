// 通用工具函数
/**
 * 从 Tiptap JSON 中提取纯文本
 */
export function extractPlainText(content) {
  if (!content || typeof content !== 'object') return ''
  let result = ''
  function walk(node) {
    if (!node) return
    if (node.text) result += node.text
    if (Array.isArray(node.content)) {
      for (const child of node.content) walk(child)
      if (node.type === 'paragraph' || node.type === 'heading') result += '\n'
    }
  }
  walk(content)
  return result.trim()
}

/**
 * 字数统计（中英文友好）
 */
export function countWords(text) {
  if (!text) return 0
  const cn = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const en = (text.match(/[a-zA-Z]+/g) || []).length
  return cn + en
}

/**
 * 异步处理 try/catch 包装
 */
export function asyncRoute(fn) {
  return async (req, reply) => {
    try {
      await fn(req, reply)
    } catch (err) {
      req.log.error(err)
      const code = err.code || err.statusCode || 500
      reply.code(code >= 400 && code < 600 ? code : 500)
      return { error: err.message || 'internal_error', code: err.code }
    }
  }
}
