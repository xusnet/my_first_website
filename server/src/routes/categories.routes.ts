import { Router } from 'express'
import { z } from 'zod'
import pool from '../db/pool.js'
import redis from '../cache/redis.js'
import { AppError } from '../middleware/error.js'
import { requirePermission } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { writeAudit } from '../utils/audit.js'
import { slugify } from '../utils/slug.js'
import type { Request } from 'express'

function ctxOf(req: Request) {
  return { ip: req.ip, userAgent: req.headers['user-agent']?.slice(0, 500) }
}
async function invalidateBlogCache(): Promise<void> {
  const keys = await redis.keys('blog:*')
  if (keys.length) await redis.del(keys)
}

const schema = z.object({
  name: z.string().min(1).max(64),
  slug: z.string().max(128).optional(),
  description: z.string().max(255).nullable().optional(),
})

export const categoriesRouter = Router()

categoriesRouter.get('/', requirePermission('category:read'), async (_req, res, next) => {
  try {
    const rows = await pool.query(
      `SELECT c.*, COUNT(pc.post_id) AS post_count
       FROM categories c LEFT JOIN post_categories pc ON pc.category_id = c.id
       GROUP BY c.id ORDER BY c.id ASC`,
    )
    res.json({ items: rows })
  } catch (err) {
    next(err)
  }
})

categoriesRouter.post('/', requirePermission('category:create'), validate(schema), async (req, res, next) => {
  try {
    const slug = req.body.slug?.trim() || slugify(req.body.name)
    const dup = await pool.query('SELECT id FROM categories WHERE slug = ? OR name = ?', [slug, req.body.name])
    if (dup.length) throw new AppError(409, 'CONFLICT', '分类名称或 slug 已存在')
    const r = await pool.query('INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)', [
      req.body.name,
      slug,
      req.body.description ?? null,
    ])
    await invalidateBlogCache()
    await writeAudit({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'category:create',
      resource: 'category',
      resourceId: Number(r.insertId),
      ip: ctxOf(req).ip,
      userAgent: ctxOf(req).userAgent,
      detail: { name: req.body.name, slug },
    })
    res.status(201).json({ id: Number(r.insertId), slug })
  } catch (err) {
    next(err)
  }
})

categoriesRouter.put('/:id', requirePermission('category:update'), validate(schema), async (req, res, next) => {
  try {
    const [c] = await pool.query<Array<{ id: number; name: string }>>('SELECT id, name FROM categories WHERE id = ?', [
      req.params.id,
    ])
    if (!c) throw new AppError(404, 'NOT_FOUND', '分类不存在')
    const slug = req.body.slug?.trim() || slugify(req.body.name)
    const dup = await pool.query('SELECT id FROM categories WHERE (slug = ? OR name = ?) AND id <> ?', [
      slug,
      req.body.name,
      c.id,
    ])
    if (dup.length) throw new AppError(409, 'CONFLICT', '分类名称或 slug 已存在')
    await pool.query('UPDATE categories SET name = ?, slug = ?, description = ? WHERE id = ?', [
      req.body.name,
      slug,
      req.body.description ?? null,
      c.id,
    ])
    await invalidateBlogCache()
    await writeAudit({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'category:update',
      resource: 'category',
      resourceId: c.id,
      ip: ctxOf(req).ip,
      userAgent: ctxOf(req).userAgent,
      detail: { name: req.body.name, slug },
    })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

categoriesRouter.delete('/:id', requirePermission('category:delete'), async (req, res, next) => {
  try {
    const [c] = await pool.query<Array<{ id: number; name: string }>>('SELECT id, name FROM categories WHERE id = ?', [
      req.params.id,
    ])
    if (!c) throw new AppError(404, 'NOT_FOUND', '分类不存在')
    await pool.query('DELETE FROM categories WHERE id = ?', [c.id])
    await invalidateBlogCache()
    await writeAudit({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'category:delete',
      resource: 'category',
      resourceId: c.id,
      ip: ctxOf(req).ip,
      userAgent: ctxOf(req).userAgent,
      detail: { name: c.name },
    })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})
