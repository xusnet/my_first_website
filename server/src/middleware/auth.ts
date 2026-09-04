import type { NextFunction, Request, Response } from 'express'
import { verifyAccessToken } from '../utils/crypto.js'
import { AppError } from './error.js'
import { getAuthUser } from '../services/authCache.js'

export function extractBearer(req: Request): string | undefined {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return undefined
  return header.slice(7).trim()
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearer(req)
  if (!token) {
    next(new AppError(401, 'UNAUTHORIZED', '未登录或缺少凭证'))
    return
  }
  let payload
  try {
    payload = verifyAccessToken(token)
  } catch {
    next(new AppError(401, 'UNAUTHORIZED', '凭证无效或已过期'))
    return
  }
  getAuthUser(Number(payload.sub))
    .then((user) => {
      if (!user || user.status !== 'active') {
        throw new AppError(401, 'UNAUTHORIZED', '账号不存在或已禁用')
      }
      req.user = user
      next()
    })
    .catch(next)
}

/**
 * 强制改密守卫：账号处于 must_change_password 状态时，
 * 仅放行「修改口令 / 当前用户信息 / 退出登录」三类请求。
 */
export function requirePasswordChanged(req: Request, _res: Response, next: NextFunction): void {
  const user = req.user
  if (user?.mustChangePassword) {
    const allowed = /^\/api\/auth\/(change-password|me|logout)$/.test(req.path)
    if (!allowed) {
      next(new AppError(403, 'PASSWORD_CHANGE_REQUIRED', '首次登录请先修改初始口令'))
      return
    }
  }
  next()
}
