import { Router } from 'express'
import pool from '../db/pool.js'
import { requirePermission } from '../middleware/rbac.js'

export const permissionsRouter = Router()

permissionsRouter.get('/', requirePermission('permission:read'), async (_req, res, next) => {
  try {
    const rows = await pool.query(
      'SELECT id, code, name, module, description FROM permissions ORDER BY module, id',
    )
    const grouped = new Map<string, Array<Record<string, unknown>>>()
    for (const r of rows as Array<Record<string, unknown>>) {
      const m = String(r.module)
      if (!grouped.has(m)) grouped.set(m, [])
      grouped.get(m)!.push(r)
    }
    res.json({
      items: rows,
      modules: Array.from(grouped.entries()).map(([module, perms]) => ({ module, perms })),
    })
  } catch (err) {
    next(err)
  }
})
