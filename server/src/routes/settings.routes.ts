import { Router } from 'express'
import { z } from 'zod'
import pool from '../db/pool.js'
import redis from '../cache/redis.js'
import { AppError } from '../middleware/error.js'
import { requirePermission } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { writeAudit } from '../utils/audit.js'
import { invalidateAuthUser } from '../services/authCache.js'
import type { Request } from 'express'

function ctxOf(req: Request) {
  return { ip: req.ip, userAgent: req.headers['user-agent']?.slice(0, 500) }
}

async function getSiteSettings(): Promise<Record<string, string>> {
  const rows = await pool.query<Array<{ skey: string; svalue: string | null }>>('SELECT skey, svalue FROM site_settings')
  const map: Record<string, string> = {}
  for (const r of rows) map[r.skey] = r.svalue ?? ''
  return map
}

const SITE_VALUE_MAX = 2000
const SITE_LONG_KEYS = new Set(['about.content'])
const SITE_LONG_VALUE_MAX = 50000
const siteSchema = z
  .record(z.string(), z.string().max(SITE_LONG_VALUE_MAX))
  .superRefine((val, ctx) => {
    for (const [key, value] of Object.entries(val)) {
      if (!SITE_LONG_KEYS.has(key) && value.length > SITE_VALUE_MAX) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `配置项 ${key} 超过 ${SITE_VALUE_MAX} 字符`, path: [key] })
      }
    }
  })

export const settingsRouter = Router()

settingsRouter.get('/site', requirePermission('settings:read'), async (_req, res, next) => {
  try {
    res.json(await getSiteSettings())
  } catch (err) {
    next(err)
  }
})

settingsRouter.put('/site', requirePermission('settings:update'), validate(siteSchema), async (req, res, next) => {
  try {
    const entries = Object.entries(req.body)
    if (!entries.length) throw new AppError(400, 'BAD_REQUEST', '没有可更新的配置')
    for (const [key, value] of entries) {
      if (!/^[a-z][a-z0-9._-]*$/i.test(key)) throw new AppError(400, 'BAD_REQUEST', `非法配置项: ${key}`)
      await pool.query(
        `INSERT INTO site_settings (skey, svalue) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE svalue = VALUES(svalue)`,
        [key, value],
      )
    }
    const keys = await redis.keys('blog:site')
    if (keys.length) await redis.del(keys)
    await writeAudit({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'settings:update',
      resource: 'settings',
      resourceId: 'site',
      ip: ctxOf(req).ip,
      userAgent: ctxOf(req).userAgent,
      detail: { keys: Object.keys(req.body) },
    })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

const mySettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.string().max(16).optional(),
  emailNotifications: z.boolean().optional(),
  bio: z.string().max(2000).nullable().optional(),
  socialGithub: z.string().url().max(255).nullable().optional(),
  socialTwitter: z.string().url().max(255).nullable().optional(),
  socialEmail: z.string().email().max(255).nullable().optional(),
})

settingsRouter.get('/me', async (req, res, next) => {
  try {
    const [s] = await pool.query<Array<Record<string, unknown>>>(
      'SELECT theme, language, email_notifications, bio, social_github, social_twitter, social_email FROM user_settings WHERE user_id = ?',
      [req.user!.id],
    )
    res.json(s ?? {})
  } catch (err) {
    next(err)
  }
})

settingsRouter.put('/me', validate(mySettingsSchema), async (req, res, next) => {
  try {
    const u = req.user!
    const b = req.body
    await pool.query(
      `INSERT INTO user_settings (user_id, theme, language, email_notifications, bio, social_github, social_twitter, social_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         theme = COALESCE(?, theme),
         language = COALESCE(?, language),
         email_notifications = COALESCE(?, email_notifications),
         bio = COALESCE(?, bio),
         social_github = COALESCE(?, social_github),
         social_twitter = COALESCE(?, social_twitter),
         social_email = COALESCE(?, social_email)`,
      [
        u.id,
        b.theme ?? 'light',
        b.language ?? 'zh-CN',
        b.emailNotifications ?? true,
        b.bio ?? null,
        b.socialGithub ?? null,
        b.socialTwitter ?? null,
        b.socialEmail ?? null,
        b.theme ?? null,
        b.language ?? null,
        b.emailNotifications ?? null,
        b.bio ?? null,
        b.socialGithub ?? null,
        b.socialTwitter ?? null,
        b.socialEmail ?? null,
      ],
    )
    await writeAudit({
      userId: u.id,
      username: u.username,
      action: 'settings:update-me',
      resource: 'settings',
      resourceId: `user:${u.id}`,
      ip: ctxOf(req).ip,
      userAgent: ctxOf(req).userAgent,
      detail: { keys: Object.keys(b) },
    })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

const profileSchema = z.object({
  displayName: z.string().max(128).nullable().optional(),
  email: z.string().email().max(255).optional(),
  avatarUrl: z.string().url().max(512).nullable().optional(),
})

settingsRouter.put('/me/profile', validate(profileSchema), async (req, res, next) => {
  try {
    const u = req.user!
    const { displayName, email, avatarUrl } = req.body
    if (email) {
      const dup = await pool.query('SELECT id FROM users WHERE email = ? AND id <> ?', [email, u.id])
      if (dup.length) throw new AppError(409, 'CONFLICT', '邮箱已被使用')
    }
    await pool.query(
      'UPDATE users SET display_name = COALESCE(?, display_name), email = COALESCE(?, email), avatar_url = COALESCE(?, avatar_url) WHERE id = ?',
      [displayName, email, avatarUrl, u.id],
    )
    await invalidateAuthUser(u.id)
    await writeAudit({
      userId: u.id,
      username: u.username,
      action: 'settings:update-profile',
      resource: 'settings',
      resourceId: `user:${u.id}`,
      ip: ctxOf(req).ip,
      userAgent: ctxOf(req).userAgent,
      detail: { displayName, email },
    })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})
