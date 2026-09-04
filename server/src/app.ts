import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import pool from './db/pool.js'
import { securityHeaders, requestId, globalRateLimit } from './middleware/security.js'
import { authenticate, requirePasswordChanged } from './middleware/auth.js'
import { errorHandler, notFound } from './middleware/error.js'
import { authRouter } from './routes/auth.routes.js'
import { publicRouter } from './routes/public.routes.js'
import { usersRouter } from './routes/users.routes.js'
import { rolesRouter } from './routes/roles.routes.js'
import { permissionsRouter } from './routes/permissions.routes.js'
import { postsRouter } from './routes/posts.routes.js'
import { categoriesRouter } from './routes/categories.routes.js'
import { tagsRouter } from './routes/tags.routes.js'
import { auditRouter } from './routes/audit.routes.js'
import { settingsRouter } from './routes/settings.routes.js'
import { requirePermission } from './middleware/rbac.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function createApp(): express.Express {
  const app = express()

  app.disable('x-powered-by')
  app.use(securityHeaders())
  app.use(requestId)
  app.use(globalRateLimit())
  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '2mb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'clarkgong-server', time: new Date().toISOString() })
  })

  // 公开博客接口
  app.use('/api/public', publicRouter)

  // 认证
  app.use('/api/auth', authRouter)

  // 受保护的管理端接口（须登录 + 已改初始口令）
  const protectedApi = express.Router()
  protectedApi.use(authenticate)
  protectedApi.use(requirePasswordChanged)

  protectedApi.get('/dashboard', requirePermission('dashboard:read'), async (_req, res, next) => {
    try {
      const [userCount] = await pool.query<Array<{ n: number }>>('SELECT COUNT(*) AS n FROM users')
      const [postCount] = await pool.query<Array<{ n: number }>>('SELECT COUNT(*) AS n FROM posts')
      const [published] = await pool.query<Array<{ n: number }>>(
        "SELECT COUNT(*) AS n FROM posts WHERE status = 'published'",
      )
      const [drafts] = await pool.query<Array<{ n: number }>>("SELECT COUNT(*) AS n FROM posts WHERE status = 'draft'")
      const [categoryCount] = await pool.query<Array<{ n: number }>>('SELECT COUNT(*) AS n FROM categories')
      const [tagCount] = await pool.query<Array<{ n: number }>>('SELECT COUNT(*) AS n FROM tags')
      const [auditCount] = await pool.query<Array<{ n: number }>>('SELECT COUNT(*) AS n FROM audit_logs')
      const recentPosts = await pool.query(
        `SELECT p.id, p.title, p.status, p.updated_at, u.username AS author_name
         FROM posts p JOIN users u ON u.id = p.author_id ORDER BY p.updated_at DESC LIMIT 5`,
      )
      const recentAudits = await pool.query(
        'SELECT id, username, action, resource, result, created_at FROM audit_logs ORDER BY id DESC LIMIT 8',
      )
      res.json({
        stats: {
          users: Number(userCount?.n ?? 0),
          posts: Number(postCount?.n ?? 0),
          published: Number(published?.n ?? 0),
          drafts: Number(drafts?.n ?? 0),
          categories: Number(categoryCount?.n ?? 0),
          tags: Number(tagCount?.n ?? 0),
          auditLogs: Number(auditCount?.n ?? 0),
        },
        recentPosts,
        recentAudits,
      })
    } catch (err) {
      next(err)
    }
  })

  protectedApi.use('/users', usersRouter)
  protectedApi.use('/roles', rolesRouter)
  protectedApi.use('/permissions', permissionsRouter)
  protectedApi.use('/posts', postsRouter)
  protectedApi.use('/categories', categoriesRouter)
  protectedApi.use('/tags', tagsRouter)
  protectedApi.use('/audit', auditRouter)
  protectedApi.use('/settings', settingsRouter)
  app.use('/api', protectedApi)

  // 静态托管 + SPA 回退（非 /api 请求）
  const distDir = path.resolve(__dirname, '../../client/dist')
  app.use(express.static(distDir))
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })

  app.use(notFound)
  app.use(errorHandler)

  return app
}
