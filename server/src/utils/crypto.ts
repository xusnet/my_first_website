import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

export function hmacSha256(secret: string, input: string): string {
  return crypto.createHmac('sha256', secret).update(input).digest('hex')
}

export interface AccessTokenPayload {
  sub: string
  username: string
  type: 'access'
  jti: string
}

export interface RefreshTokenPayload {
  sub: string
  type: 'refresh'
  jti: string
}

export function signAccessToken(userId: number, username: string): string {
  const jti = crypto.randomUUID()
  return jwt.sign({ username, type: 'access', jti } as AccessTokenPayload, config.jwt.accessSecret, {
    subject: String(userId),
    expiresIn: config.jwt.accessTtl as jwt.SignOptions['expiresIn'],
  })
}

export function signRefreshToken(userId: number): string {
  const jti = crypto.randomUUID()
  return jwt.sign({ type: 'refresh', jti } as RefreshTokenPayload, config.jwt.refreshSecret, {
    subject: String(userId),
    expiresIn: config.jwt.refreshTtl as jwt.SignOptions['expiresIn'],
  })
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, config.jwt.accessSecret) as AccessTokenPayload
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, config.jwt.refreshSecret) as RefreshTokenPayload
}
