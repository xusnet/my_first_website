import type { NextFunction, Request, Response } from 'express'
import { AppError } from './error.js'

/**
 * RBAC 权限守卫：校验当前用户是否拥有指定权限编码。
 * 超级管理员（is_superadmin）拥有全部权限。
 */
export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user
    if (!user) {
      next(new AppError(401, 'UNAUTHORIZED', '未登录'))
      return
    }
    if (user.isSuperadmin || user.permissions.includes(permission)) {
      next()
      return
    }
    next(new AppError(403, 'FORBIDDEN', '没有权限执行此操作'))
  }
}
