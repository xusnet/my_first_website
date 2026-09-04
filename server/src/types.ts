import type { Request } from 'express'

export interface AuthUser {
  id: number
  username: string
  displayName: string | null
  email: string
  avatarUrl: string | null
  status: string
  isSuperadmin: boolean
  mustChangePassword: boolean
  permissions: string[]
  roles: string[]
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
      requestId?: string
    }
  }
}

export {}
