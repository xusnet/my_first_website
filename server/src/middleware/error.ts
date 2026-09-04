import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'

export class AppError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function notFound(_req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(404, 'NOT_FOUND', '资源不存在'))
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: '请求参数校验失败',
      errors: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    })
    return
  }
  if (err instanceof AppError) {
    res.status(err.status).json({ code: err.code, message: err.message })
    return
  }
  console.error('[error]', req.method, req.originalUrl, err)
  res.status(500).json({ code: 'INTERNAL_ERROR', message: '服务器内部错误' })
}
