// 导出路由
// 支持：Markdown、纯文本、docx（原生 zip + XML，零外部依赖）、PDF（puppeteer-core）
import { asyncRoute } from '../utils.js'
import { extractPlainText } from '../utils.js'
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, PageBreak
} from 'docx'

export default async function exportRoutes(app, { prisma }) {

  // 通用：获取书籍 + 章节
  async function loadBook(bookId) {
    return prisma.book.findUnique({
      where: { id: bookId },
      include: {
        chapters: {
          orderBy: [{ parentId: 'asc' }, { position: 'asc' }]
        }
      }
    })
  }

  // ===== Markdown =====
  app.get('/api/books/:bookId/export/markdown', asyncRoute(async (req, reply) => {
    const book = await loadBook(req.params.bookId)
    if (!book) { reply.code(404); return { error: 'book_not_found' } }

    const lines = []
    lines.push(`# ${book.title}`)
    lines.push('')
    if (book.summary) {
      lines.push(`> ${book.summary}`)
      lines.push('')
    }
    lines.push(`> 创建于 ${book.createdAt.toISOString().slice(0, 10)} · 状态：${statusLabel(book.status)} · 共 ${book.chapters.length} 章`)
    lines.push('')
    lines.push('---')
    lines.push('')
    lines.push('## 目录')
    lines.push('')
    book.chapters.forEach((ch, i) => {
      lines.push(`${i + 1}. ${ch.title}（${ch.wordCount} 字）`)
    })
    lines.push('')
    lines.push('---')
    lines.push('')

    for (const ch of book.chapters) {
      const level = ch.parentId ? 2 : 1
      lines.push(`${'#'.repeat(level)} ${ch.title}`)
      lines.push('')
      const text = ch.contentText || extractPlainText(ch.content)
      if (text) { lines.push(text); lines.push('') }
      lines.push('---')
      lines.push('')
    }

    sendFile(reply, lines.join('\n'), 'text/markdown; charset=utf-8', safeName(book.title) + '.md')
  }))

  // ===== 纯文本 =====
  app.get('/api/books/:bookId/export/txt', asyncRoute(async (req, reply) => {
    const book = await loadBook(req.params.bookId)
    if (!book) { reply.code(404); return { error: 'book_not_found' } }
    const lines = []
    lines.push(book.title)
    lines.push('='.repeat(Math.min(book.title.length, 40)))
    lines.push('')
    for (const ch of book.chapters) {
      lines.push(ch.title)
      lines.push('-'.repeat(Math.min(ch.title.length, 40)))
      lines.push('')
      const text = ch.contentText || extractPlainText(ch.content)
      if (text) lines.push(text)
      lines.push('')
    }
    sendFile(reply, lines.join('\n'), 'text/plain; charset=utf-8', safeName(book.title) + '.txt')
  }))

  // ===== docx =====
  app.get('/api/books/:bookId/export/docx', asyncRoute(async (req, reply) => {
    const book = await loadBook(req.params.bookId)
    if (!book) { reply.code(404); return { error: 'book_not_found' } }

    const children = []

    // 封面
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 2400, after: 400 },
      children: [new TextRun({ text: book.title, bold: true, size: 56 })]
    }))
    if (book.summary) {
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
        children: [new TextRun({ text: book.summary, italics: true, size: 24 })]
      }))
    }
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({
        text: `共 ${book.chapters.length} 章 · ${chaptersTotalWords(book)} 字`,
        size: 20, color: '888888'
      })]
    }))
    children.push(new Paragraph({ children: [new PageBreak()] }))

    // 目录
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun('目录')]
    }))
    book.chapters.forEach((ch, i) => {
      children.push(new Paragraph({
        children: [new TextRun({ text: `${i + 1}. ${ch.title}（${ch.wordCount} 字）`, size: 22 })]
      }))
    })
    children.push(new Paragraph({ children: [new PageBreak()] }))

    // 章节内容
    for (const ch of book.chapters) {
      const heading = ch.parentId ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_1
      children.push(new Paragraph({
        heading,
        children: [new TextRun({ text: ch.title })]
      }))
      // 从 Tiptap JSON 渲染
      const blocks = renderTiptapToDocx(ch.content)
      children.push(...blocks)
      // 章节分页
      children.push(new Paragraph({ children: [new PageBreak()] }))
    }

    const doc = new Document({
      creator: 'NovelCraft',
      title: book.title,
      description: book.summary || '',
      sections: [{ children }]
    })

    const buffer = await Packer.toBuffer(doc)
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    reply.header('Content-Disposition', `attachment; filename="${safeName(book.title)}.docx"`)
    reply.header('Content-Length', buffer.length)
    return reply.send(buffer)
  }))

  // ===== PDF（HTML 打印风格）=====
  // 用后端渲染一个排版好的 HTML，前端调用 window.print() 即可，或后端直接返回 HTML
  app.get('/api/books/:bookId/export/pdf-html', asyncRoute(async (req, reply) => {
    const book = await loadBook(req.params.bookId)
    if (!book) { reply.code(404); return { error: 'book_not_found' } }

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(book.title)}</title>
<style>
  @page { size: A4; margin: 2.5cm; }
  body { font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", serif; color: #222; line-height: 1.8; max-width: 800px; margin: 0 auto; padding: 40px; }
  .cover { text-align: center; padding: 120px 0; page-break-after: always; }
  .cover h1 { font-size: 42px; margin-bottom: 24px; }
  .cover .summary { font-style: italic; color: #666; font-size: 16px; margin-bottom: 32px; }
  .cover .meta { color: #999; font-size: 13px; }
  .toc { page-break-after: always; }
  .toc h2 { font-size: 24px; border-bottom: 2px solid #333; padding-bottom: 8px; }
  .toc ul { list-style: none; padding: 0; }
  .toc li { padding: 8px 0; border-bottom: 1px dashed #ddd; display: flex; justify-content: space-between; }
  .toc .words { color: #999; font-size: 13px; }
  .chapter { page-break-before: always; }
  .chapter h1 { font-size: 28px; text-align: center; margin: 60px 0 40px; }
  .chapter h2 { font-size: 22px; margin: 32px 0 16px; }
  p { text-indent: 2em; margin: 0 0 1em; }
  blockquote { border-left: 3px solid #ccc; padding-left: 16px; color: #555; font-style: italic; margin: 1em 0; }
  .no-print { display: none; }
  @media print {
    body { padding: 0; }
    .print-tip { display: none; }
  }
</style>
</head>
<body>
  <div class="print-tip" style="background: #fff3cd; padding: 12px; border-radius: 4px; margin-bottom: 20px; text-align: center;">
    💡 按 <kbd>Ctrl+P</kbd>（Mac: <kbd>⌘+P</kbd>）保存为 PDF
  </div>
  <div class="cover">
    <h1>${escapeHtml(book.title)}</h1>
    ${book.summary ? `<div class="summary">${escapeHtml(book.summary)}</div>` : ''}
    <div class="meta">共 ${book.chapters.length} 章 · ${chaptersTotalWords(book)} 字</div>
  </div>
  <div class="toc">
    <h2>目录</h2>
    <ul>
      ${book.chapters.map((ch, i) =>
        `<li><span>${i + 1}. ${escapeHtml(ch.title)}</span><span class="words">${ch.wordCount} 字</span></li>`
      ).join('')}
    </ul>
  </div>
  ${book.chapters.map(ch => `
    <div class="chapter">
      <h${ch.parentId ? 2 : 1}>${escapeHtml(ch.title)}</h${ch.parentId ? 2 : 1}>
      ${renderTiptapToHtml(ch.content)}
    </div>
  `).join('')}
</body>
</html>`
    sendFile(reply, html, 'text/html; charset=utf-8', safeName(book.title) + '.html')
  }))

  // ===== 单章节导出（Markdown）=====
  app.get('/api/chapters/:id/export/markdown', asyncRoute(async (req, reply) => {
    const ch = await prisma.chapter.findUnique({
      where: { id: req.params.id },
      include: { book: true }
    })
    if (!ch) { reply.code(404); return { error: 'chapter_not_found' } }
    const md = `# ${ch.title}\n\n${ch.contentText || extractPlainText(ch.content)}\n`
    sendFile(reply, md, 'text/markdown; charset=utf-8', safeName(ch.title) + '.md')
  }))

  // ===== 统计 =====
  app.get('/api/books/:bookId/stats', asyncRoute(async (req) => {
    const chapters = await prisma.chapter.findMany({
      where: { bookId: req.params.bookId },
      select: { wordCount: true, updatedAt: true }
    })
    const totalWords = chapters.reduce((s, c) => s + c.wordCount, 0)
    const lastUpdated = chapters.reduce((max, c) =>
      c.updatedAt > max ? c.updatedAt : max, new Date(0))
    return {
      chapterCount: chapters.length,
      totalWords,
      lastUpdated,
      averageWords: chapters.length ? Math.round(totalWords / chapters.length) : 0
    }
  }))

  // ===== 热力图数据 =====
  app.get('/api/books/:bookId/heatmap', asyncRoute(async (req) => {
    const { days = 365 } = req.query
    const since = new Date(Date.now() - Number(days) * 86400 * 1000)
    const snaps = await prisma.dailySnapshot.findMany({
      where: { bookId: req.params.bookId, date: { gte: since.toISOString().slice(0, 10) } },
      orderBy: { date: 'asc' }
    })
    return { snapshots: snaps }
  }))
}

// ===== 工具函数 =====

function sendFile(reply, content, contentType, filename) {
  reply.header('Content-Type', contentType)
  reply.header('Content-Disposition', `attachment; filename="${filename}"`)
  return reply.send(content)
}

function safeName(name) {
  return name.replace(/[^\w\u4e00-\u9fa5\-]+/g, '_').slice(0, 50) || 'untitled'
}

function statusLabel(s) {
  return { drafting: '在写', archiving: '存稿', completed: '完结' }[s] || s
}

function chaptersTotalWords(book) {
  return book.chapters.reduce((s, c) => s + c.wordCount, 0)
}

function escapeHtml(s) {
  if (!s) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * 将 Tiptap JSON 渲染为 docx 段落数组
 */
function renderTiptapToDocx(content) {
  if (!content || !Array.isArray(content.content)) return []
  const out = []
  for (const node of content.content) {
    if (node.type === 'paragraph') {
      out.push(new Paragraph({
        children: renderInlineToRuns(node.content || [])
      }))
    } else if (node.type === 'heading') {
      const level = node.attrs?.level || 1
      const headingMap = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 }
      out.push(new Paragraph({
        heading: headingMap[level],
        children: renderInlineToRuns(node.content || [])
      }))
    } else if (node.type === 'blockquote') {
      // docx 的 blockquote 用缩进模拟
      for (const child of (node.content || [])) {
        out.push(new Paragraph({
          indent: { left: 720 },
          children: renderInlineToRuns(child.content || [])
        }))
      }
    } else if (node.type === 'bulletList' || node.type === 'orderedList') {
      for (const item of (node.content || [])) {
        const marker = node.type === 'orderedList' ? '1.' : '•'
        out.push(new Paragraph({
          indent: { left: 360 },
          children: [new TextRun(marker + ' '), ...renderInlineToRuns((item.content?.[0]?.content) || [])]
        }))
      }
    } else if (node.type === 'codeBlock') {
      const text = (node.content || []).map(c => c.text || '').join('')
      out.push(new Paragraph({
        children: [new TextRun({ text, font: 'Consolas', size: 20 })]
      }))
    } else if (node.type === 'horizontalRule') {
      out.push(new Paragraph({
        border: { bottom: { color: '999999', space: 1, style: 'single', size: 6 } },
        children: []
      }))
    }
  }
  return out
}

function renderInlineToRuns(content) {
  return content.map(node => {
    if (node.type === 'text') {
      return new TextRun({
        text: node.text || '',
        bold: !!node.marks?.find(m => m.type === 'bold'),
        italics: !!node.marks?.find(m => m.type === 'italic'),
        break: node.marks?.find(m => m.type === 'hardBreak') ? 1 : undefined
      })
    }
    return new TextRun('')
  })
}

/**
 * 将 Tiptap JSON 渲染为 HTML（用于 PDF 预览页）
 */
function renderTiptapToHtml(content) {
  if (!content || !Array.isArray(content.content)) return ''
  return content.map(node => {
    if (node.type === 'paragraph') {
      return `<p>${renderInlineToHtml(node.content || [])}</p>`
    }
    if (node.type === 'heading') {
      const lvl = node.attrs?.level || 1
      return `<h${lvl}>${renderInlineToHtml(node.content || [])}</h${lvl}>`
    }
    if (node.type === 'blockquote') {
      return `<blockquote>${(node.content || []).map(renderTiptapToHtml).join('')}</blockquote>`
    }
    if (node.type === 'bulletList') {
      return `<ul>${(node.content || []).map(li => `<li>${renderInlineToHtml(li.content?.[0]?.content || [])}</li>`).join('')}</ul>`
    }
    if (node.type === 'orderedList') {
      return `<ol>${(node.content || []).map(li => `<li>${renderInlineToHtml(li.content?.[0]?.content || [])}</li>`).join('')}</ol>`
    }
    if (node.type === 'codeBlock') {
      const text = (node.content || []).map(c => c.text || '').join('')
      return `<pre><code>${escapeHtml(text)}</code></pre>`
    }
    if (node.type === 'horizontalRule') return '<hr/>'
    return ''
  }).join('\n')
}

function renderInlineToHtml(content) {
  return content.map(node => {
    if (node.type === 'text') {
      let html = escapeHtml(node.text || '')
      for (const mark of (node.marks || [])) {
        if (mark.type === 'bold') html = `<strong>${html}</strong>`
        else if (mark.type === 'italic') html = `<em>${html}</em>`
        else if (mark.type === 'code') html = `<code>${html}</code>`
        else if (mark.type === 'link') html = `<a href="${escapeHtml(mark.attrs?.href || '#')}">${html}</a>`
      }
      return html
    }
    if (node.type === 'hardBreak') return '<br/>'
    return ''
  }).join('')
}
