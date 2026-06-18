// 用户认证 + 会话管理
import { asyncRoute } from '../utils.js'
import { hashPassword, verifyPassword } from '../auth.js'

export default async function authRoutes(app, { prisma }) {

  // 注册（首用户自动成为管理员）
  app.post('/api/auth/register', asyncRoute(async (req, reply) => {
    const { username, password, nickname } = req.body || {}
    if (!username || !password) {
      reply.code(400); return { error: 'username_and_password_required' }
    }
    if (username.length < 3 || username.length > 30) {
      reply.code(400); return { error: 'username_length_3_30' }
    }
    if (password.length < 6) {
      reply.code(400); return { error: 'password_length_6' }
    }
    const existing = await prisma.user.findUnique({ where: { username } })
    if (existing) { reply.code(409); return { error: 'username_taken' } }

    // 检查是否第一个用户
    const count = await prisma.user.count()
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash: hashPassword(password),
        nickname: nickname || username,
        isAdmin: count === 0
      },
      select: { id: true, username: true, nickname: true, isAdmin: true, createdAt: true }
    })
    reply.code(201)
    return { user }
  }))

  // 登录
  app.post('/api/auth/login', asyncRoute(async (req, reply) => {
    const { username, password } = req.body || {}
    if (!username || !password) {
      reply.code(400); return { error: 'username_and_password_required' }
    }
    const user = await prisma.user.findUnique({ where: { username } })
    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      reply.code(401); return { error: 'invalid_credentials' }
    }
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

    const accessToken = await reply.jwtSign(
      { sub: user.id, username: user.username, isAdmin: user.isAdmin },
      { expiresIn: '7d' }
    )

    return {
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        isAdmin: user.isAdmin
      }
    }
  }))

  // 当前用户
  app.get('/api/auth/me', asyncRoute(async (req, reply) => {
    try {
      await req.jwtVerify()
    } catch (err) {
      reply.code(401); return { error: 'unauthorized' }
    }
    const userId = req.user.sub
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, nickname: true, avatar: true, isAdmin: true, createdAt: true }
    })
    if (!user) { reply.code(404); return { error: 'user_not_found' } }
    return { user }
  }))

  // 修改密码
  app.post('/api/auth/change-password', asyncRoute(async (req, reply) => {
    try { await req.jwtVerify() } catch (err) { reply.code(401); return { error: 'unauthorized' } }
    const { oldPassword, newPassword } = req.body || {}
    if (!oldPassword || !newPassword) {
      reply.code(400); return { error: 'both_passwords_required' }
    }
    const user = await prisma.user.findUnique({ where: { id: req.user.sub } })
    if (!user || !verifyPassword(oldPassword, user.passwordHash)) {
      reply.code(401); return { error: 'old_password_wrong' }
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(newPassword) }
    })
    return { ok: true }
  }))

  // 列出所有用户（仅管理员）
  app.get('/api/auth/users', asyncRoute(async (req, reply) => {
    try { await req.jwtVerify() } catch (err) { reply.code(401); return { error: 'unauthorized' } }
    if (!req.user.isAdmin) { reply.code(403); return { error: 'forbidden' } }
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, username: true, nickname: true, isAdmin: true, createdAt: true, lastLoginAt: true }
    })
    return { users }
  }))
}
