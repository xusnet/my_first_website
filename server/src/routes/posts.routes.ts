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

const postSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(255),
  slug: z.string().max(255).optional(),
  excerpt: z.string().max(500).nullable().optional(),
  content: z.string().min(1, '内容不能为空'),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  coverImage: z.string().url().max(512).nullable().optional(),
  categoryIds: z.array(z.number().int().positive()).optional(),
  tagIds: z.array(z.number().int().positive()).optional(),
  tagNames: z.array(z.string().min(1).max(64)).optional(),
})

const publishSchema = z.object({ status: z.enum(['published', 'archived', 'draft']) })

export const postsRouter = Router()

async function withRelations(post: Record<string, unknown>) {
  const cats = await pool.query(
    `SELECT c.id, c.name, c.slug FROM categories c
     JOIN post_categories pc ON pc.category_id = c.id WHERE pc.post_id = ?`,
    [post.id],
  )
  const tags = await pool.query(
    `SELECT t.id, t.name, t.slug FROM tags t
     JOIN post_tags pt ON pt.tag_id = t.id WHERE pt.post_id = ?`,
    [post.id],
  )
  return { ...post, categories: cats, tags }
}

async function invalidatePostCache(): Promise<void> {
  const keys = await redis.keys('blog:post:*')
  if (keys.length) await redis.del(keys)
}

function canEditPost(req: Request, authorId: number): boolean {
  const u = req.user!
  if (u.isSuperadmin) return true
  if (u.permissions.includes('post:update')) return true
  if (u.permissions.includes('post:create') && u.id === authorId) return true
  return false
}

postsRouter.get('/', requirePermission('post:read'), async (req, res, next) => {
  try {
    const search = String(req.query.search ?? '').trim()
    const status = String(req.query.status ?? '').trim()
    const categoryId = Number(req.query.categoryId) || 0
    const tagId = Number(req.query.tagId) || 0
    const page = Math.max(1, Number(req.query.page) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20))

    const cond: string[] = []
    const params: unknown[] = []
    if (search) {
      cond.push('(p.title LIKE ? OR p.excerpt LIKE ?)')
      params.push(`%${search}%`, `%${search}%`)
    }
    if (status) {
      cond.push('p.status = ?')
      params.push(status)
    }
    if (categoryId) {
      cond.push('EXISTS (SELECT 1 FROM post_categories pc WHERE pc.post_id = p.id AND pc.category_id = ?)')
      params.push(categoryId)
    }
    if (tagId) {
      cond.push('EXISTS (SELECT 1 FROM post_tags pt WHERE pt.post_id = p.id AND pt.tag_id = ?)')
      params.push(tagId)
    }
    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : ''

    const rows = await pool.query(
      `SELECT p.id, p.title, p.slug, p.excerpt, p.status, p.cover_image, p.published_at,
              p.created_at, p.updated_at, p.author_id, u.username AS author_name
       FROM posts p JOIN users u ON u.id = p.author_id
       ${where} ORDER BY p.updated_at DESC, p.id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize],
    )
    const [cnt] = await pool.query<Array<{ n: number }>>(
      `SELECT COUNT(*) AS n FROM posts p ${where}`,
      params,
    )

    const cats = await pool.query(
      `SELECT pc.post_id, c.id, c.name, c.slug FROM post_categories pc JOIN categories c ON c.id = pc.category_id`,
    )
    const tags = await pool.query(
      `SELECT pt.post_id, t.id, t.name, t.slug FROM post_tags pt JOIN tags t ON t.id = pt.tag_id`,
    )
    const catsByPost = new Map<number, unknown[]>()
    for (const r of cats as Array<Record<string, unknown>>) {
      const pid = Number(r.post_id)
      if (!catsByPost.has(pid)) catsByPost.set(pid, [])
      catsByPost.get(pid)!.push({ id: r.id, name: r.name, slug: r.slug })
    }
    const tagsByPost = new Map<number, unknown[]>()
    for (const r of tags as Array<Record<string, unknown>>) {
      const pid = Number(r.post_id)
      if (!tagsByPost.has(pid)) tagsByPost.set(pid, [])
      tagsByPost.get(pid)!.push({ id: r.id, name: r.name, slug: r.slug })
    }

    const items = (rows as Array<Record<string, unknown>>).map((p) => ({
      ...p,
      categories: catsByPost.get(Number(p.id)) ?? [],
      tags: tagsByPost.get(Number(p.id)) ?? [],
    }))
    res.json({ items, total: Number(cnt?.n ?? 0), page, pageSize })
  } catch (err) {
    next(err)
  }
})

postsRouter.get('/:id', requirePermission('post:read'), async (req, res, next) => {
  try {
    const [p] = await pool.query<Array<Record<string, unknown>>>(
      `SELECT p.*, u.username AS author_name FROM posts p JOIN users u ON u.id = p.author_id WHERE p.id = ?`,
      [req.params.id],
    )
    if (!p) throw new AppError(404, 'NOT_FOUND', '文章不存在')
    res.json(await withRelations(p))
  } catch (err) {
    next(err)
  }
})

postsRouter.post('/', requirePermission('post:create'), validate(postSchema), async (req, res, next) => {
  try {
    const b = req.body
    const slug = b.slug?.trim() || slugify(b.title)
    const dup = await pool.query('SELECT id FROM posts WHERE slug = ?', [slug])
    if (dup.length) throw new AppError(409, 'CONFLICT', 'slug 已存在')

    const status = b.status ?? 'draft'
    const publishedAt = status === 'published' ? new Date() : null
    const r = await pool.query(
      `INSERT INTO posts (title, slug, excerpt, content, status, cover_image, published_at, author_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [b.title, slug, b.excerpt ?? null, b.content, status, b.coverImage ?? null, publishedAt, req.user!.id],
    )
    const postId = Number(r.insertId)
    await setRelations(postId, b.categoryIds, b.tagIds, b.tagNames)
    await invalidatePostCache()

    await writeAudit({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'post:create',
      resource: 'post',
      resourceId: postId,
      ip: ctxOf(req).ip,
      userAgent: ctxOf(req).userAgent,
      detail: { title: b.title, status },
    })
    res.status(201).json({ id: postId, slug })
  } catch (err) {
    next(err)
  }
})

postsRouter.put('/:id', requirePermission('post:update'), validate(postSchema), async (req, res, next) => {
  try {
    const [p] = await pool.query<Array<{ id: number; author_id: number; title: string }>>(
      'SELECT id, author_id, title FROM posts WHERE id = ?',
      [req.params.id],
    )
    if (!p) throw new AppError(404, 'NOT_FOUND', '文章不存在')
    if (!canEditPost(req, p.author_id)) {
      throw new AppError(403, 'FORBIDDEN', '只能编辑自己的文章')
    }
    const b = req.body
    const slug = b.slug?.trim() || slugify(b.title)
    const dup = await pool.query('SELECT id FROM posts WHERE slug = ? AND id <> ?', [slug, p.id])
    if (dup.length) throw new AppError(409, 'CONFLICT', 'slug 已存在')

    await pool.query(
      `UPDATE posts SET title = ?, slug = ?, excerpt = ?, content = ?, cover_image = COALESCE(?, cover_image)
       WHERE id = ?`,
      [b.title, slug, b.excerpt ?? null, b.content, b.coverImage ?? null, p.id],
    )
    if (b.categoryIds !== undefined || b.tagIds !== undefined || b.tagNames !== undefined) {
      await setRelations(p.id, b.categoryIds, b.tagIds, b.tagNames)
    }
    await invalidatePostCache()

    await writeAudit({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'post:update',
      resource: 'post',
      resourceId: p.id,
      ip: ctxOf(req).ip,
      userAgent: ctxOf(req).userAgent,
      detail: { title: b.title, slug },
    })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

postsRouter.delete('/:id', requirePermission('post:delete'), async (req, res, next) => {
  try {
    const [p] = await pool.query<Array<{ id: number; author_id: number; title: string }>>(
      'SELECT id, author_id, title FROM posts WHERE id = ?',
      [req.params.id],
    )
    if (!p) throw new AppError(404, 'NOT_FOUND', '文章不存在')
    if (!canEditPost(req, p.author_id)) {
      throw new AppError(403, 'FORBIDDEN', '只能删除自己的文章')
    }
    await pool.query('DELETE FROM posts WHERE id = ?', [p.id])
    await invalidatePostCache()

    await writeAudit({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'post:delete',
      resource: 'post',
      resourceId: p.id,
      ip: ctxOf(req).ip,
      userAgent: ctxOf(req).userAgent,
      detail: { title: p.title },
    })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

postsRouter.post('/:id/publish', requirePermission('post:publish'), validate(publishSchema), async (req, res, next) => {
  try {
    const [p] = await pool.query<Array<{ id: number; title: string }>>('SELECT id, title FROM posts WHERE id = ?', [
      req.params.id,
    ])
    if (!p) throw new AppError(404, 'NOT_FOUND', '文章不存在')
    const status = req.body.status
    const publishedAt = status === 'published' ? new Date() : null
    await pool.query('UPDATE posts SET status = ?, published_at = COALESCE(?, published_at) WHERE id = ?', [
      status,
      publishedAt,
      p.id,
    ])
    await invalidatePostCache()

    await writeAudit({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'post:publish',
      resource: 'post',
      resourceId: p.id,
      ip: ctxOf(req).ip,
      userAgent: ctxOf(req).userAgent,
      detail: { title: p.title, status },
    })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

async function setRelations(
  postId: number,
  categoryIds?: number[],
  tagIds?: number[],
  tagNames?: string[],
): Promise<void> {
  if (categoryIds !== undefined) {
    await pool.query('DELETE FROM post_categories WHERE post_id = ?', [postId])
    if (categoryIds.length) {
      await pool.query('INSERT IGNORE INTO post_categories (post_id, category_id) VALUES (?, ?)', [postId, categoryIds])
    }
  }
  if (tagIds !== undefined || tagNames !== undefined) {
    const ids = [...(tagIds ?? [])]
    if (tagNames?.length) {
      for (const name of tagNames) {
        const slug = slugify(name)
        const existing = await pool.query<Array<{ id: number }>>('SELECT id FROM tags WHERE slug = ?', [slug])
        let tid: number
        if (existing.length) {
          tid = existing[0].id
        } else {
          const r = await pool.query('INSERT INTO tags (name, slug) VALUES (?, ?)', [name, slug])
          tid = Number(r.insertId)
        }
        ids.push(tid)
      }
    }
    await pool.query('DELETE FROM post_tags WHERE post_id = ?', [postId])
    if (ids.length) {
      await pool.query('INSERT IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)', [postId, ids])
    }
  }
}
