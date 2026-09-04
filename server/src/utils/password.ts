import bcrypt from 'bcryptjs'
import { config } from '../config.js'

export interface PasswordPolicyResult {
  ok: boolean
  errors: string[]
}

/**
 * 等保三级复杂口令校验：
 *  - 长度 >= minLength（默认 12）
 *  - 必须含大写、小写、数字、特殊字符
 *  - 不得与用户名相同 / 过于简单
 */
export function validatePassword(password: string, username?: string): PasswordPolicyResult {
  const errors: string[] = []
  const p = config.password

  if (!password) {
    return { ok: false, errors: ['口令不能为空'] }
  }
  if (password.length < p.minLength) {
    errors.push(`口令长度至少 ${p.minLength} 位`)
  }
  if (p.requireUpper && !/[A-Z]/.test(password)) {
    errors.push('口令必须包含大写字母')
  }
  if (p.requireLower && !/[a-z]/.test(password)) {
    errors.push('口令必须包含小写字母')
  }
  if (p.requireDigit && !/\d/.test(password)) {
    errors.push('口令必须包含数字')
  }
  if (p.requireSpecial && !/[^A-Za-z0-9]/.test(password)) {
    errors.push('口令必须包含特殊字符')
  }
  if (/(.)\1{2,}/.test(password)) {
    errors.push('口令不能包含连续 3 个相同字符')
  }
  if (username && password.toLowerCase().includes(username.toLowerCase()) && username.length >= 4) {
    errors.push('口令不能包含用户名')
  }

  return { ok: errors.length === 0, errors }
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/** 口令是否即将/已经超过有效期（等保：口令定期更换） */
export function isPasswordExpired(passwordChangedAt: Date | null | undefined): boolean {
  if (!passwordChangedAt) return true
  const ageDays = (Date.now() - new Date(passwordChangedAt).getTime()) / 86_400_000
  return ageDays >= config.password.maxAgeDays
}
