import { Router } from 'express'
import pool from '../db/pool.js'
import redis from '../cache/redis.js'

const CACHE_TTL = 60

async function cached<T>(key: string, ttl: number, loader: () => Promise<T>): Promise<T> {
  const hit = await redis.get(key)
  if (hit) return JSON.parse(hit) as T
  const value = await loader()
  await redis.set(key, JSON.stringify(value), 'EX', ttl)
  return value
}

export const publicRouter = Router()

publicRouter.get('/site', async (_req, res, next) => {
  try {
    const data = await cached('blog:site', CACHE_TTL, async () => {
      const rows = await pool.query<Array<{ skey: string; svalue: string | null }>>(
        'SELECT skey, svalue FROM site_settings',
      )
      const map: Record<string, string> = {}
      for (const r of rows) map[r.skey] = r.svalue ?? ''
      return map
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
})

publicRouter.get('/posts', async (req, res, next) => {
  try {
    const category = String(req.query.category ?? '').trim()
    const tag = String(req.query.tag ?? '').trim()
    const page = Math.max(1, Number(req.query.page) || 1)
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 10))
    const cacheKey = `blog:posts:${category}:${tag}:${page}:${pageSize}`

    const data = await cached(cacheKey, CACHE_TTL, async () => {
      const cond: string[] = ["p.status = 'published'"]
      const params: unknown[] = []
      if (category) {
        cond.push('EXISTS (SELECT 1 FROM post_categories pc JOIN categories c ON c.id = pc.category_id WHERE pc.post_id = p.id AND c.slug = ?)')
        params.push(category)
      }
      if (tag) {
        cond.push('EXISTS (SELECT 1 FROM post_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.post_id = p.id AND t.slug = ?)')
        params.push(tag)
      }
      const where = `WHERE ${cond.join(' AND ')}`

      const rows = await pool.query(
        `SELECT p.id, p.title, p.slug, p.excerpt, p.cover_image, p.published_at, p.updated_at,
                u.display_name AS author_name, u.username AS author_username
         FROM posts p JOIN users u ON u.id = p.author_id
         ${where} ORDER BY p.published_at DESC, p.id DESC LIMIT ? OFFSET ?`,
        [...params, pageSize, (page - 1) * pageSize],
      )
      const [cnt] = await pool.query<Array<{ n: number }>>(
        `SELECT COUNT(*) AS n FROM posts p ${where}`,
        params,
      )

      const ids = (rows as Array<Record<string, unknown>>).map((p) => Number(p.id))
      let cats: unknown = []
      let tags: unknown = []
      if (ids.length) {
        cats = await pool.query(
          `SELECT pc.post_id, c.name, c.slug FROM post_categories pc JOIN categories c ON c.id = pc.category_id
           WHERE pc.post_id IN (?)`,
          [ids],
        )
        tags = await pool.query(
          `SELECT pt.post_id, t.name, t.slug FROM post_tags pt JOIN tags t ON t.id = pt.tag_id
           WHERE pt.post_id IN (?)`,
          [ids],
        )
      }
      const catsByPost = new Map<number, Array<{ name: string; slug: string }>>()
      for (const r of cats as Array<Record<string, unknown>>) {
        const pid = Number(r.post_id)
        if (!catsByPost.has(pid)) catsByPost.set(pid, [])
        catsByPost.get(pid)!.push({ name: String(r.name), slug: String(r.slug) })
      }
      const tagsByPost = new Map<number, Array<{ name: string; slug: string }>>()
      for (const r of tags as Array<Record<string, unknown>>) {
        const pid = Number(r.post_id)
        if (!tagsByPost.has(pid)) tagsByPost.set(pid, [])
        tagsByPost.get(pid)!.push({ name: String(r.name), slug: String(r.slug) })
      }
      const items = (rows as Array<Record<string, unknown>>).map((p) => ({
        ...p,
        categories: catsByPost.get(Number(p.id)) ?? [],
        tags: tagsByPost.get(Number(p.id)) ?? [],
      }))
      return { items, total: Number(cnt?.n ?? 0), page, pageSize }
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
})

publicRouter.get('/posts/:slug', async (req, res, next) => {
  try {
    const data = await cached(`blog:post:${req.params.slug}`, CACHE_TTL, async () => {
      const [p] = await pool.query<Array<Record<string, unknown>>>(
        `SELECT p.id, p.title, p.slug, p.excerpt, p.content, p.cover_image, p.published_at, p.updated_at,
                u.display_name AS author_name, u.username AS author_username
         FROM posts p JOIN users u ON u.id = p.author_id
         WHERE p.slug = ? AND p.status = 'published'`,
        [req.params.slug],
      )
      if (!p) return null
      const cats = await pool.query(
        `SELECT c.name, c.slug FROM categories c JOIN post_categories pc ON pc.category_id = c.id WHERE pc.post_id = ?`,
        [p.id],
      )
      const tags = await pool.query(
        `SELECT t.name, t.slug FROM tags t JOIN post_tags pt ON pt.tag_id = t.id WHERE pt.post_id = ?`,
        [p.id],
      )
      return { ...p, categories: cats, tags }
    })
    if (!data) {
      res.status(404).json({ code: 'NOT_FOUND', message: '文章不存在' })
      return
    }
    res.json(data)
  } catch (err) {
    next(err)
  }
})

publicRouter.get('/categories', async (_req, res, next) => {
  try {
    const data = await cached('blog:cats', CACHE_TTL, async () => {
      const rows = await pool.query(
        `SELECT c.id, c.name, c.slug, c.description, COUNT(pc.post_id) AS post_count
         FROM categories c
         LEFT JOIN post_categories pc ON pc.category_id = c.id
         LEFT JOIN posts p ON p.id = pc.post_id AND p.status = 'published'
         GROUP BY c.id HAVING post_count > 0 ORDER BY c.id ASC`,
      )
      return rows
    })
    res.json({ items: data })
  } catch (err) {
    next(err)
  }
})

publicRouter.get('/tags', async (_req, res, next) => {
  try {
    const data = await cached('blog:tags', CACHE_TTL, async () => {
      const rows = await pool.query(
        `SELECT t.id, t.name, t.slug, COUNT(pt.post_id) AS post_count
         FROM tags t
         LEFT JOIN post_tags pt ON pt.tag_id = t.id
         LEFT JOIN posts p ON p.id = pt.post_id AND p.status = 'published'
         GROUP BY t.id HAVING post_count > 0 ORDER BY post_count DESC, t.id ASC`,
      )
      return rows
    })
    res.json({ items: data })
  } catch (err) {
    next(err)
  }
})
