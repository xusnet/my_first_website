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

const schema = z.object({ name: z.string().min(1).max(64) })

export const tagsRouter = Router()

tagsRouter.get('/', requirePermission('tag:read'), async (_req, res, next) => {
  try {
    const rows = await pool.query(
      `SELECT t.*, COUNT(pt.post_id) AS post_count
       FROM tags t LEFT JOIN post_tags pt ON pt.tag_id = t.id
       GROUP BY t.id ORDER BY post_count DESC, t.id ASC`,
    )
    res.json({ items: rows })
  } catch (err) {
    next(err)
  }
})

tagsRouter.post('/', requirePermission('tag:create'), validate(schema), async (req, res, next) => {
  try {
    const slug = slugify(req.body.name)
    const dup = await pool.query('SELECT id FROM tags WHERE slug = ? OR name = ?', [slug, req.body.name])
    if (dup.length) throw new AppError(409, 'CONFLICT', '标签已存在')
    const r = await pool.query('INSERT INTO tags (name, slug) VALUES (?, ?)', [req.body.name, slug])
    await invalidateBlogCache()
    await writeAudit({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'tag:create',
      resource: 'tag',
      resourceId: Number(r.insertId),
      ip: ctxOf(req).ip,
      userAgent: ctxOf(req).userAgent,
      detail: { name: req.body.name },
    })
    res.status(201).json({ id: Number(r.insertId), slug })
  } catch (err) {
    next(err)
  }
})

tagsRouter.put('/:id', requirePermission('tag:update'), validate(schema), async (req, res, next) => {
  try {
    const [t] = await pool.query<Array<{ id: number; name: string }>>('SELECT id, name FROM tags WHERE id = ?', [
      req.params.id,
    ])
    if (!t) throw new AppError(404, 'NOT_FOUND', '标签不存在')
    const slug = slugify(req.body.name)
    const dup = await pool.query('SELECT id FROM tags WHERE (slug = ? OR name = ?) AND id <> ?', [
      slug,
      req.body.name,
      t.id,
    ])
    if (dup.length) throw new AppError(409, 'CONFLICT', '标签已存在')
    await pool.query('UPDATE tags SET name = ?, slug = ? WHERE id = ?', [req.body.name, slug, t.id])
    await invalidateBlogCache()
    await writeAudit({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'tag:update',
      resource: 'tag',
      resourceId: t.id,
      ip: ctxOf(req).ip,
      userAgent: ctxOf(req).userAgent,
      detail: { name: req.body.name },
    })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

tagsRouter.delete('/:id', requirePermission('tag:delete'), async (req, res, next) => {
  try {
    const [t] = await pool.query<Array<{ id: number; name: string }>>('SELECT id, name FROM tags WHERE id = ?', [
      req.params.id,
    ])
    if (!t) throw new AppError(404, 'NOT_FOUND', '标签不存在')
    await pool.query('DELETE FROM tags WHERE id = ?', [t.id])
    await invalidateBlogCache()
    await writeAudit({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'tag:delete',
      resource: 'tag',
      resourceId: t.id,
      ip: ctxOf(req).ip,
      userAgent: ctxOf(req).userAgent,
      detail: { name: t.name },
    })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})
