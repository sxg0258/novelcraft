// 字数统计工具：每日快照
// 在章节保存时自动调用，记录今日总字数与 delta
import { prisma } from './db.js'

/**
 * 更新或创建今日字数快照
 * @param {string} bookId
 * @param {number} newTotalWords 当前书的总字数
 */
export async function recordSnapshot(bookId, newTotalWords) {
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  // 找昨天的快照，作为今日 delta 的基准
  const yesterday = new Date(Date.now() - 86400 * 1000).toISOString().slice(0, 10)
  const prev = await prisma.dailySnapshot.findUnique({
    where: { bookId_date: { bookId, date: yesterday } }
  })

  const baseline = prev?.wordCount ?? 0
  // 如果今天是第一次记录，delta = newTotalWords（视为今日新写）
  // 否则，delta = newTotalWords - prev.wordCount（当日累计变化）
  const existing = await prisma.dailySnapshot.findUnique({
    where: { bookId_date: { bookId, date: today } }
  })

  const delta = existing
    ? Math.max(0, newTotalWords - existing.wordCount) + (newTotalWords > existing.wordCount ? newTotalWords - existing.wordCount : 0)
    : Math.max(0, newTotalWords - baseline)

  await prisma.dailySnapshot.upsert({
    where: { bookId_date: { bookId, date: today } },
    update: {
      wordCount: newTotalWords,
      delta: { increment: Math.max(0, newTotalWords - (existing?.wordCount || 0)) }
    },
    create: {
      bookId,
      date: today,
      wordCount: newTotalWords,
      delta: Math.max(0, newTotalWords - baseline)
    }
  })
}

/**
 * 获取一本书的总字数（用于快照）
 */
export async function getTotalWords(bookId) {
  const result = await prisma.chapter.aggregate({
    where: { bookId },
    _sum: { wordCount: true }
  })
  return result._sum.wordCount || 0
}
