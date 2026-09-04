import crypto from 'node:crypto'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import type { NextFunction, Request, Response } from 'express'
import { config } from '../config.js'

export function securityHeaders(): ReturnType<typeof helmet> {
  return helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
}

export function requestId(_req: Request, res: Response, next: NextFunction): void {
  const id = crypto.randomUUID()
  res.setHeader('X-Request-Id', id)
  next()
}

export function globalRateLimit(): ReturnType<typeof rateLimit> {
  return rateLimit({
    windowMs: 60_000,
    limit: config.rateLimit.globalPerMin,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' },
  })
}

export function authRateLimit(): ReturnType<typeof rateLimit> {
  return rateLimit({
    windowMs: 60_000,
    limit: config.rateLimit.authPerMin,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    message: { code: 'RATE_LIMITED', message: '登录尝试过于频繁，请稍后再试' },
  })
}
