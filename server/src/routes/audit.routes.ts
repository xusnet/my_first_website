import { Router } from 'express'
import pool from '../db/pool.js'
import { requirePermission } from '../middleware/rbac.js'
import { verifyAuditChain } from '../utils/audit.js'

export const auditRouter = Router()

auditRouter.use(requirePermission('audit:read'))

auditRouter.get('/', async (req, res, next) => {
  try {
    const search = String(req.query.search ?? '').trim()
    const action = String(req.query.action ?? '').trim()
    const result = String(req.query.result ?? '').trim()
    const page = Math.max(1, Number(req.query.page) || 1)
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 50))

    const cond: string[] = []
    const params: unknown[] = []
    if (search) {
      cond.push('(username LIKE ? OR resource LIKE ? OR detail LIKE ?)')
      params.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }
    if (action) {
      cond.push('action = ?')
      params.push(action)
    }
    if (result) {
      cond.push('result = ?')
      params.push(result)
    }
    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : ''

    const rows = await pool.query(
      `SELECT id, user_id, username, action, resource, resource_id, ip, user_agent, result, detail, prev_hash, log_hash, created_at
       FROM audit_logs ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize],
    )
    const [cnt] = await pool.query<Array<{ n: number }>>(`SELECT COUNT(*) AS n FROM audit_logs ${where}`, params)
    res.json({ items: rows, total: Number(cnt?.n ?? 0), page, pageSize })
  } catch (err) {
    next(err)
  }
})

auditRouter.get('/actions', async (_req, res, next) => {
  try {
    const rows = await pool.query('SELECT DISTINCT action FROM audit_logs ORDER BY action')
    res.json({ items: (rows as Array<{ action: string }>).map((r) => r.action) })
  } catch (err) {
    next(err)
  }
})

auditRouter.get('/verify', async (_req, res, next) => {
  try {
    const result = await verifyAuditChain()
    res.json(result)
  } catch (err) {
    next(err)
  }
})
