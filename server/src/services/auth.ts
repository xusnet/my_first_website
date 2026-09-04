import pool from '../db/pool.js'
import redis from '../cache/redis.js'
import { config } from '../config.js'
import { AppError } from '../middleware/error.js'
import { verifyPassword, validatePassword, isPasswordExpired } from '../utils/password.js'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/crypto.js'
import { writeAudit } from '../utils/audit.js'
import { getAuthUser, invalidateAuthUser } from './authCache.js'
import type { AuthUser } from '../types.js'

const REFRESH_TTL_SEC = 7 * 24 * 3600

interface AuthContext {
  ip?: string
  userAgent?: string
}

function lockKey(username: string): string {
  return `login:fail:${username.toLowerCase()}`
}

export async function checkLockout(username: string): Promise<number> {
  const n = await redis.get(lockKey(username))
  return n ? Number(n) : 0
}

export async function login(
  username: string,
  password: string,
  ctx: AuthContext,
): Promise<{ accessToken: string; refreshToken: string; user: AuthUser; mustChangePassword: boolean }> {
  const [row] = await pool.query<Array<Record<string, unknown>>>(
    'SELECT id, username, email, display_name, avatar_url, status, password_hash, must_change_password, locked_until, password_changed_at FROM users WHERE username = ? OR email = ?',
    [username, username],
  )

  if (!row || String(row.status) === 'disabled') {
    await writeAudit({
      username: username ?? 'unknown',
      action: 'login',
      resource: 'auth',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      result: 'failure',
      detail: '用户不存在或已禁用',
    })
    throw new AppError(401, 'INVALID_CREDENTIALS', '用户名或口令错误')
  }

  if (String(row.status) === 'locked' && row.locked_until && new Date(row.locked_until as string | Date) > new Date()) {
    await writeAudit({
      userId: Number(row.id),
      username: String(row.username),
      action: 'login',
      resource: 'auth',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      result: 'failure',
      detail: '账号已锁定',
    })
    throw new AppError(423, 'ACCOUNT_LOCKED', `账号已锁定，请稍后再试或联系管理员`)
  }

  const ok = await verifyPassword(password, String(row.password_hash))
  if (!ok) {
    const attempts = (await redis.incr(lockKey(String(row.username)))) 
    await redis.expire(lockKey(String(row.username)), config.login.lockMinutes * 60)
    await pool.query('UPDATE users SET failed_attempts = ? WHERE id = ?', [attempts, row.id])
    if (attempts >= config.login.maxAttempts) {
      const until = new Date(Date.now() + config.login.lockMinutes * 60_000)
      await pool.query('UPDATE users SET status = ?, locked_until = ? WHERE id = ?', ['locked', until, row.id])
      await writeAudit({
        userId: Number(row.id),
        username: String(row.username),
        action: 'login',
        resource: 'auth',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        result: 'failure',
        detail: `口令错误次数达到阈值，账号已锁定`,
      })
      throw new AppError(423, 'ACCOUNT_LOCKED', '连续登录失败，账号已锁定 15 分钟')
    }
    await writeAudit({
      userId: Number(row.id),
      username: String(row.username),
      action: 'login',
      resource: 'auth',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      result: 'failure',
      detail: `口令错误（第 ${attempts} 次）`,
    })
    throw new AppError(401, 'INVALID_CREDENTIALS', '用户名或口令错误')
  }

  // 登录成功：清空失败计数
  await redis.del(lockKey(String(row.username)))
  await pool.query(
    'UPDATE users SET failed_attempts = 0, status = ?, locked_until = NULL, last_login_at = NOW(), last_login_ip = ? WHERE id = ?',
    ['active', ctx.ip ?? null, row.id],
  )
  await invalidateAuthUser(Number(row.id))

  const user = await getAuthUser(Number(row.id), true)
  if (!user) throw new AppError(500, 'INTERNAL_ERROR', '用户加载失败')

  const mustChange = Boolean(row.must_change_password) || isPasswordExpired(row.password_changed_at as Date | null)

  const accessToken = signAccessToken(user.id, user.username)
  const refreshToken = signRefreshToken(user.id)
  const jti = verifyRefreshToken(refreshToken).jti
  await redis.set(`sess:refresh:${jti}`, String(user.id), 'EX', REFRESH_TTL_SEC)

  await writeAudit({
    userId: user.id,
    username: user.username,
    action: 'login',
    resource: 'auth',
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    result: 'success',
    detail: mustChange ? '登录成功（需改密）' : '登录成功',
  })

  return { accessToken, refreshToken, user, mustChangePassword: mustChange }
}

export async function refresh(refreshToken: string, ctx: AuthContext): Promise<{ accessToken: string; refreshToken: string }> {
  let payload
  try {
    payload = verifyRefreshToken(refreshToken)
  } catch {
    throw new AppError(401, 'INVALID_TOKEN', '刷新令牌无效或已过期')
  }
  const userId = await redis.get(`sess:refresh:${payload.jti}`)
  if (!userId) {
    throw new AppError(401, 'INVALID_TOKEN', '刷新令牌已失效，请重新登录')
  }
  const user = await getAuthUser(Number(userId))
  if (!user || user.status !== 'active') {
    throw new AppError(401, 'INVALID_TOKEN', '账号状态异常')
  }

  await redis.del(`sess:refresh:${payload.jti}`)
  const newAccess = signAccessToken(user.id, user.username)
  const newRefresh = signRefreshToken(user.id)
  const newJti = verifyRefreshToken(newRefresh).jti
  await redis.set(`sess:refresh:${newJti}`, String(user.id), 'EX', REFRESH_TTL_SEC)

  await writeAudit({
    userId: user.id,
    username: user.username,
    action: 'refresh-token',
    resource: 'auth',
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    result: 'success',
  })

  return { accessToken: newAccess, refreshToken: newRefresh }
}

export async function logout(refreshToken: string | undefined, ctx: AuthContext, user?: AuthUser): Promise<void> {
  if (refreshToken) {
    try {
      const payload = verifyRefreshToken(refreshToken)
      await redis.del(`sess:refresh:${payload.jti}`)
    } catch {
      // ignore invalid refresh token on logout
    }
  }
  await writeAudit({
    userId: user?.id,
    username: user?.username,
    action: 'logout',
    resource: 'auth',
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    result: 'success',
  })
}

export async function changePassword(
  user: AuthUser,
  oldPassword: string,
  newPassword: string,
  ctx: AuthContext,
): Promise<void> {
  const [row] = await pool.query<Array<{ password_hash: string; must_change_password: number }>>(
    'SELECT password_hash, must_change_password FROM users WHERE id = ?',
    [user.id],
  )
  if (!row) throw new AppError(404, 'NOT_FOUND', '用户不存在')

  if (!(await verifyPassword(oldPassword, row.password_hash))) {
    await writeAudit({
      userId: user.id,
      username: user.username,
      action: 'change-password',
      resource: 'auth',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      result: 'failure',
      detail: '原口令校验失败',
    })
    throw new AppError(400, 'BAD_OLD_PASSWORD', '原口令不正确')
  }

  const policy = validatePassword(newPassword, user.username)
  if (!policy.ok) {
    throw new AppError(400, 'WEAK_PASSWORD', policy.errors.join('；'))
  }
  if (oldPassword === newPassword) {
    throw new AppError(400, 'WEAK_PASSWORD', '新口令不能与原口令相同')
  }

  // 口令历史检查：不得与最近 N 次口令相同
  const history = await pool.query<Array<{ password_hash: string }>>(
    'SELECT password_hash FROM password_history WHERE user_id = ? ORDER BY id DESC LIMIT ?',
    [user.id, config.password.history],
  )
  for (const h of history) {
    if (await verifyPassword(newPassword, h.password_hash)) {
      await writeAudit({
        userId: user.id,
        username: user.username,
        action: 'change-password',
        resource: 'auth',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        result: 'failure',
        detail: `与最近 ${config.password.history} 次口令重复`,
      })
      throw new AppError(400, 'PASSWORD_REUSED', `新口令不能与最近 ${config.password.history} 次口令相同`)
    }
  }

  const { hashPassword } = await import('../utils/password.js')
  const newHash = await hashPassword(newPassword)
  await pool.query(
    `UPDATE users SET password_hash = ?, must_change_password = 0, password_changed_at = NOW() WHERE id = ?`,
    [newHash, user.id],
  )
  await pool.query('INSERT INTO password_history (user_id, password_hash) VALUES (?, ?)', [user.id, newHash])
  // 清理历史，仅保留最近 N 条
  const keep = config.password.history
  await pool.query(
    `DELETE FROM password_history WHERE user_id = ? AND id NOT IN (
       SELECT id FROM (SELECT id FROM password_history WHERE user_id = ? ORDER BY id DESC LIMIT ?) t
     )`,
    [user.id, user.id, keep],
  )

  // 改密后吊销所有刷新令牌
  const sessionKeys = await redis.keys('sess:refresh:*')
  const values = await redis.mget(sessionKeys)
  const mine = sessionKeys.filter((_: string, i: number) => values[i] === String(user.id))
  if (mine.length) await redis.del(mine)
  await invalidateAuthUser(user.id)

  await writeAudit({
    userId: user.id,
    username: user.username,
    action: 'change-password',
    resource: 'auth',
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    result: 'success',
  })
}
