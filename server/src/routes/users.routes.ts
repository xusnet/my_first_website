import { Router } from 'express'
import crypto from 'node:crypto'
import { z } from 'zod'
import pool from '../db/pool.js'
import redis from '../cache/redis.js'
import { AppError } from '../middleware/error.js'
import { requirePermission } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { writeAudit } from '../utils/audit.js'
import { hashPassword, validatePassword } from '../utils/password.js'
import { invalidateAuthUser } from '../services/authCache.js'
import type { Request } from 'express'

function ctxOf(req: Request) {
  return { ip: req.ip, userAgent: req.headers['user-agent']?.slice(0, 500) }
}

const createSchema = z.object({
  username: z.string().min(3, '用户名至少 3 位').max(64).regex(/^[a-zA-Z0-9_.-]+$/, '用户名只能包含字母、数字、下划线、点、横线'),
  email: z.string().email('邮箱格式不正确').max(255),
  displayName: z.string().max(128).optional(),
  password: z.string().max(128).optional(),
  status: z.enum(['active', 'disabled']).optional(),
  roleIds: z.array(z.number().int().positive()).optional(),
})

const updateSchema = z.object({
  displayName: z.string().max(128).nullable().optional(),
  email: z.string().email().max(255).optional(),
  avatarUrl: z.string().url().max(512).nullable().optional(),
  status: z.enum(['active', 'disabled', 'locked']).optional(),
})

const roleAssignSchema = z.object({ roleIds: z.array(z.number().int().positive()) })

const resetPwdSchema = z.object({
  newPassword: z.string().min(1).max(128).optional(),
})

export const usersRouter = Router()

usersRouter.use(requirePermission('user:read'))

usersRouter.get('/', async (req, res, next) => {
  try {
    const search = String(req.query.search ?? '').trim()
    const page = Math.max(1, Number(req.query.page) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20))
    const where = search ? 'WHERE u.username LIKE ? OR u.email LIKE ? OR u.display_name LIKE ?' : ''
    const like = `%${search}%`
    const params = search ? [like, like, like] : []

    const rows = await pool.query(
      `SELECT u.id, u.username, u.email, u.display_name, u.avatar_url, u.status, u.is_superadmin,
              u.failed_attempts, u.locked_until, u.must_change_password, u.last_login_at, u.last_login_ip,
              u.created_at, u.updated_at
       FROM users u ${where} ORDER BY u.id ASC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize],
    )
    const [countRow] = await pool.query<Array<{ n: number }>>(
      `SELECT COUNT(*) AS n FROM users u ${where}`,
      params,
    )
    const roleRows = await pool.query<Array<{ user_id: number; code: string; name: string }>>(
      `SELECT ur.user_id, r.code, r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id`,
    )
    const rolesByUser = new Map<number, Array<{ code: string; name: string }>>()
    for (const r of roleRows) {
      if (!rolesByUser.has(r.user_id)) rolesByUser.set(r.user_id, [])
      rolesByUser.get(r.user_id)!.push({ code: r.code, name: r.name })
    }
    const items = (rows as Array<Record<string, unknown>>).map((u) => ({
      ...u,
      roles: rolesByUser.get(Number(u.id)) ?? [],
    }))
    res.json({ items, total: Number(countRow?.n ?? 0), page, pageSize })
  } catch (err) {
    next(err)
  }
})

usersRouter.get('/:id', async (req, res, next) => {
  try {
    const [u] = await pool.query<Array<Record<string, unknown>>>(
      'SELECT id, username, email, display_name, avatar_url, status, is_superadmin, must_change_password, created_at, updated_at FROM users WHERE id = ?',
      [req.params.id],
    )
    if (!u) throw new AppError(404, 'NOT_FOUND', '用户不存在')
    const roles = await pool.query<Array<{ code: string; name: string }>>(
      `SELECT r.code, r.name FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = ?`,
      [req.params.id],
    )
    const perms = await pool.query<Array<{ code: string }>>(
      `SELECT DISTINCT p.code FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       JOIN user_roles ur ON ur.role_id = rp.role_id
       WHERE ur.user_id = ?`,
      [req.params.id],
    )
    res.json({ ...u, roles, permissions: perms.map((p) => p.code) })
  } catch (err) {
    next(err)
  }
})

usersRouter.post('/', requirePermission('user:create'), validate(createSchema), async (req, res, next) => {
  try {
    const { username, email, displayName, password, status, roleIds } = req.body
    const finalPwd = password || cryptoRandomPassword()
    const policy = validatePassword(finalPwd, username)
    if (!policy.ok) throw new AppError(400, 'WEAK_PASSWORD', policy.errors.join('；'))

    const dup = await pool.query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email],
    )
    if (dup.length) throw new AppError(409, 'CONFLICT', '用户名或邮箱已存在')

    const hash = await hashPassword(finalPwd)
    const res2 = await pool.query(
      `INSERT INTO users (username, email, password_hash, display_name, status, must_change_password)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [username, email, hash, displayName ?? null, status ?? 'active'],
    )
    const userId = Number(res2.insertId)
    await pool.query('INSERT INTO password_history (user_id, password_hash) VALUES (?, ?)', [userId, hash])
    await pool.query('INSERT INTO user_settings (user_id) VALUES (?)', [userId])
    if (roleIds?.length) {
      await pool.query('INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, roleIds])
    }

    await writeAudit({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'user:create',
      resource: 'user',
      resourceId: userId,
      ip: ctxOf(req).ip,
      userAgent: ctxOf(req).userAgent,
      detail: { username, email },
    })
    res.status(201).json({ id: userId, username, email, displayName: displayName ?? null })
  } catch (err) {
    next(err)
  }
})

usersRouter.put('/:id', requirePermission('user:update'), validate(updateSchema), async (req, res, next) => {
  try {
    const [u] = await pool.query<Array<{ id: number; username: string; is_superadmin: number }>>(
      'SELECT id, username, is_superadmin FROM users WHERE id = ?',
      [req.params.id],
    )
    if (!u) throw new AppError(404, 'NOT_FOUND', '用户不存在')
    if (u.is_superadmin && req.body.status && req.body.status !== 'active' && u.id !== req.user!.id) {
      throw new AppError(403, 'FORBIDDEN', '不能禁用超级管理员')
    }
    const { displayName, email, avatarUrl, status } = req.body
    await pool.query(
      'UPDATE users SET display_name = COALESCE(?, display_name), email = COALESCE(?, email), avatar_url = COALESCE(?, avatar_url), status = COALESCE(?, status) WHERE id = ?',
      [displayName, email, avatarUrl, status, u.id],
    )
    await invalidateAuthUser(u.id)
    await writeAudit({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'user:update',
      resource: 'user',
      resourceId: u.id,
      ip: ctxOf(req).ip,
      userAgent: ctxOf(req).userAgent,
      detail: { status, email, displayName },
    })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

usersRouter.delete('/:id', requirePermission('user:delete'), async (req, res, next) => {
  try {
    const [u] = await pool.query<Array<{ id: number; username: string; is_superadmin: number }>>(
      'SELECT id, username, is_superadmin FROM users WHERE id = ?',
      [req.params.id],
    )
    if (!u) throw new AppError(404, 'NOT_FOUND', '用户不存在')
    if (u.id === req.user!.id) throw new AppError(400, 'BAD_REQUEST', '不能删除当前登录账号')
    if (u.is_superadmin) throw new AppError(403, 'FORBIDDEN', '不能删除超级管理员')
    await pool.query('DELETE FROM users WHERE id = ?', [u.id])
    await invalidateAuthUser(u.id)
    await writeAudit({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'user:delete',
      resource: 'user',
      resourceId: u.id,
      ip: ctxOf(req).ip,
      userAgent: ctxOf(req).userAgent,
      detail: { username: u.username },
    })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

usersRouter.post('/:id/reset-password', requirePermission('user:reset-password'), validate(resetPwdSchema), async (req, res, next) => {
  try {
    const [u] = await pool.query<Array<{ id: number; username: string; is_superadmin: number }>>(
      'SELECT id, username, is_superadmin FROM users WHERE id = ?',
      [req.params.id],
    )
    if (!u) throw new AppError(404, 'NOT_FOUND', '用户不存在')
    if (u.is_superadmin && u.id !== req.user!.id) throw new AppError(403, 'FORBIDDEN', '不能重置其他超级管理员口令')

    const newPwd = req.body.newPassword || cryptoRandomPassword()
    const policy = validatePassword(newPwd, u.username)
    if (!policy.ok) throw new AppError(400, 'WEAK_PASSWORD', policy.errors.join('；'))

    const hash = await hashPassword(newPwd)
    await pool.query(
      'UPDATE users SET password_hash = ?, must_change_password = 1, password_changed_at = NULL WHERE id = ?',
      [hash, u.id],
    )
    await pool.query('INSERT INTO password_history (user_id, password_hash) VALUES (?, ?)', [u.id, hash])
    await invalidateAuthUser(u.id)
    // 吊销该用户所有会话
    const sessionKeys = await redis.keys('sess:refresh:*')
    const values = await redis.mget(sessionKeys)
    const mine = sessionKeys.filter((_: string, i: number) => values[i] === String(u.id))
    if (mine.length) await redis.del(mine)

    await writeAudit({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'user:reset-password',
      resource: 'user',
      resourceId: u.id,
      ip: ctxOf(req).ip,
      userAgent: ctxOf(req).userAgent,
      detail: { username: u.username },
    })
    res.json({ ok: true, password: req.body.newPassword ? undefined : newPwd })
  } catch (err) {
    next(err)
  }
})

usersRouter.put('/:id/roles', requirePermission('user:assign-role'), validate(roleAssignSchema), async (req, res, next) => {
  try {
    const [u] = await pool.query<Array<{ id: number; username: string; is_superadmin: number }>>(
      'SELECT id, username, is_superadmin FROM users WHERE id = ?',
      [req.params.id],
    )
    if (!u) throw new AppError(404, 'NOT_FOUND', '用户不存在')
    if (u.is_superadmin && req.body.roleIds.length === 0) {
      throw new AppError(400, 'BAD_REQUEST', '超级管理员至少保留一个角色')
    }
    await pool.query('DELETE FROM user_roles WHERE user_id = ?', [u.id])
    if (req.body.roleIds.length) {
      await pool.query('INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [u.id, req.body.roleIds])
    }
    await invalidateAuthUser(u.id)
    await writeAudit({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'user:assign-role',
      resource: 'user',
      resourceId: u.id,
      ip: ctxOf(req).ip,
      userAgent: ctxOf(req).userAgent,
      detail: { username: u.username, roleIds: req.body.roleIds },
    })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

function cryptoRandomPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnpqrstuvwxyz'
  const digit = '23456789'
  const special = '!@#$%^&*_-+='
  const all = upper + lower + digit + special
  const parts = [upper, lower, digit, special].map((s) => s[crypto.randomInt(s.length)])
  for (let i = 0; i < 8; i++) parts.push(all[crypto.randomInt(all.length)])
  for (let i = parts.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1)
    ;[parts[i], parts[j]] = [parts[j], parts[i]]
  }
  return parts.join('')
}
