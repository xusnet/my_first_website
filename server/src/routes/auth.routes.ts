import { Router } from 'express'
import { z } from 'zod'
import { login, refresh, logout, changePassword } from '../services/auth.js'
import { authenticate, requirePasswordChanged } from '../middleware/auth.js'
import { authRateLimit } from '../middleware/security.js'
import { validate } from '../middleware/validate.js'
import type { Request } from 'express'

function ctxOf(req: Request) {
  return {
    ip: req.ip ?? (req.headers['x-forwarded-for'] as string) ?? undefined,
    userAgent: req.headers['user-agent']?.slice(0, 500) ?? undefined,
  }
}

const loginSchema = z.object({
  username: z.string().min(1, '请输入用户名').max(64),
  password: z.string().min(1, '请输入口令').max(128),
})

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
})

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(1).max(128),
})

export const authRouter = Router()

authRouter.post('/login', authRateLimit(), validate(loginSchema), async (req, res, next) => {
  try {
    const { username, password } = req.body
    const result = await login(username, password, ctxOf(req))
    res.json(result)
  } catch (err) {
    next(err)
  }
})

authRouter.post('/refresh', validate(refreshSchema), async (req, res, next) => {
  try {
    const result = await refresh(req.body.refreshToken, ctxOf(req))
    res.json(result)
  } catch (err) {
    next(err)
  }
})

authRouter.post('/logout', async (req, res, next) => {
  try {
    await logout(req.body?.refreshToken, ctxOf(req), req.user)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

authRouter.get('/me', authenticate, requirePasswordChanged, (req, res) => {
  res.json({ user: req.user })
})

authRouter.post('/change-password', authenticate, validate(changePasswordSchema), async (req, res, next) => {
  try {
    await changePassword(req.user!, req.body.oldPassword, req.body.newPassword, ctxOf(req))
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})
