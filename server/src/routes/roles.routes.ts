import { Router } from 'express'
import { z } from 'zod'
import pool from '../db/pool.js'
import { AppError } from '../middleware/error.js'
import { requirePermission } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { writeAudit } from '../utils/audit.js'
import { clearUserCache } from '../services/authCache.js'
import type { Request } from 'express'

function ctxOf(req: Request) {
  return { ip: req.ip, userAgent: req.headers['user-agent']?.slice(0, 500) }
}

const createSchema = z.object({
  code: z.string().min(2).max(64).regex(/^[a-z][a-z0-9_-]*$/, '角色编码需小写字母开头'),
  name: z.string().min(1).max(64),
  description: z.string().max(255).optional(),
  permissionCodes: z.array(z.string().min(1)).optional(),
})

const updateSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  description: z.string().max(255).nullable().optional(),
})

const permSchema = z.object({ permissionCodes: z.array(z.string().min(1)) })

export const rolesRouter = Router()

rolesRouter.get('/', requirePermission('role:read'), async (_req, res, next) => {
  try {
    const roles = await pool.query<Array<Record<string, unknown>>>('SELECT * FROM roles ORDER BY id ASC')
    const rp = await pool.query<Array<{ role_id: number; code: string }>>(
      'SELECT rp.role_id, p.code FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id',
    )
    const counts = await pool.query<Array<{ role_id: number; n: number }>>(
      'SELECT role_id, COUNT(*) AS n FROM user_roles GROUP BY role_id',
    )
    const permsByRole = new Map<number, string[]>()
    for (const r of rp) {
      if (!permsByRole.has(r.role_id)) permsByRole.set(r.role_id, [])
      permsByRole.get(r.role_id)!.push(r.code)
    }
    const countMap = new Map(counts.map((c) => [c.role_id, c.n]))
    res.json({
      items: (roles as Array<Record<string, unknown>>).map((r) => ({
        ...r,
        permissions: permsByRole.get(Number(r.id)) ?? [],
        userCount: countMap.get(Number(r.id)) ?? 0,
      })),
    })
  } catch (err) {
    next(err)
  }
})

rolesRouter.post('/', requirePermission('role:create'), validate(createSchema), async (req, res, next) => {
  try {
    const { code, name, description, permissionCodes } = req.body
    const dup = await pool.query('SELECT id FROM roles WHERE code = ?', [code])
    if (dup.length) throw new AppError(409, 'CONFLICT', '角色编码已存在')
    const r = await pool.query(
      'INSERT INTO roles (code, name, description) VALUES (?, ?, ?)',
      [code, name, description ?? null],
    )
    const roleId = Number(r.insertId)
    if (permissionCodes?.length) {
      const p = await pool.query(
        'SELECT id, code FROM permissions WHERE code IN (?)',
        [permissionCodes],
      )
      for (const row of p as Array<{ id: number }>) {
        await pool.query('INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleId, row.id])
      }
    }
    await writeAudit({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'role:create',
      resource: 'role',
      resourceId: roleId,
      ip: ctxOf(req).ip,
      userAgent: ctxOf(req).userAgent,
      detail: { code, name, permissionCodes: permissionCodes ?? [] },
    })
    res.status(201).json({ id: roleId })
  } catch (err) {
    next(err)
  }
})

rolesRouter.put('/:id', requirePermission('role:update'), validate(updateSchema), async (req, res, next) => {
  try {
    const [role] = await pool.query<Array<{ id: number; code: string; is_system: number }>>(
      'SELECT id, code, is_system FROM roles WHERE id = ?',
      [req.params.id],
    )
    if (!role) throw new AppError(404, 'NOT_FOUND', '角色不存在')
    const { name, description } = req.body
    await pool.query('UPDATE roles SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?', [
      name,
      description,
      role.id,
    ])
    await clearUserCache()
    await writeAudit({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'role:update',
      resource: 'role',
      resourceId: role.id,
      ip: ctxOf(req).ip,
      userAgent: ctxOf(req).userAgent,
      detail: { code: role.code, name, description },
    })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

rolesRouter.delete('/:id', requirePermission('role:delete'), async (req, res, next) => {
  try {
    const [role] = await pool.query<Array<{ id: number; code: string; is_system: number }>>(
      'SELECT id, code, is_system FROM roles WHERE id = ?',
      [req.params.id],
    )
    if (!role) throw new AppError(404, 'NOT_FOUND', '角色不存在')
    if (role.is_system) throw new AppError(403, 'FORBIDDEN', '系统内置角色不能删除')
    const [cnt] = await pool.query<Array<{ n: number }>>('SELECT COUNT(*) AS n FROM user_roles WHERE role_id = ?', [role.id])
    if (Number(cnt?.n) > 0) throw new AppError(400, 'BAD_REQUEST', '角色仍被用户使用，无法删除')
    await pool.query('DELETE FROM roles WHERE id = ?', [role.id])
    await clearUserCache()
    await writeAudit({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'role:delete',
      resource: 'role',
      resourceId: role.id,
      ip: ctxOf(req).ip,
      userAgent: ctxOf(req).userAgent,
      detail: { code: role.code },
    })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

rolesRouter.put('/:id/permissions', requirePermission('role:assign-permission'), validate(permSchema), async (req, res, next) => {
  try {
    const [role] = await pool.query<Array<{ id: number; code: string }>>('SELECT id, code FROM roles WHERE id = ?', [
      req.params.id,
    ])
    if (!role) throw new AppError(404, 'NOT_FOUND', '角色不存在')
    await pool.query('DELETE FROM role_permissions WHERE role_id = ?', [role.id])
    const codes = req.body.permissionCodes
    if (codes.length) {
      const p = await pool.query('SELECT id, code FROM permissions WHERE code IN (?)', [codes])
      for (const row of p as Array<{ id: number }>) {
        await pool.query('INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [role.id, row.id])
      }
    }
    await clearUserCache()
    await writeAudit({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'role:assign-permission',
      resource: 'role',
      resourceId: role.id,
      ip: ctxOf(req).ip,
      userAgent: ctxOf(req).userAgent,
      detail: { code: role.code, permissionCodes: codes },
    })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})
