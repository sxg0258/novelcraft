// 密码哈希工具
// 用 Node 内置 scrypt（无需额外依赖，零成本）
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const KEY_LEN = 64
const SCRYPT_N = 16384  // 内存/算力参数

/**
 * 哈希密码
 */
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N }).toString('hex')
  return `scrypt$${SCRYPT_N}$${salt}$${derived}`
}

/**
 * 校验密码
 */
export function verifyPassword(password, hash) {
  if (!hash?.startsWith('scrypt$')) return false
  const [, , salt, stored] = hash.split('$')
  if (!salt || !stored) return false
  const derived = scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N })
  const storedBuf = Buffer.from(stored, 'hex')
  if (storedBuf.length !== derived.length) return false
  return timingSafeEqual(storedBuf, derived)
}

/**
 * JWT 鉴权中间件
 */
export function requireAuth(jwt) {
  return async (req, reply) => {
    try {
      await req.jwtVerify()
    } catch (err) {
      reply.code(401)
      return { error: 'unauthorized' }
    }
  }
}

/**
 * 可选鉴权（不强求登录）
 */
export async function optionalAuth(req, reply) {
  try {
    await req.jwtVerify()
  } catch (err) {
    // 不阻塞
  }
}
