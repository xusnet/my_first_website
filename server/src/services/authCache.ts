import pool from '../db/pool.js'
import redis from '../cache/redis.js'
import type { AuthUser } from '../types.js'

const CACHE_TTL = 300 // 5 min

async function loadUserFromDb(userId: number): Promise<AuthUser | null> {
  const [u] = await pool.query<Array<Record<string, unknown>>>(
    `SELECT id, username, email, display_name, avatar_url, status, is_superadmin, must_change_password
     FROM users WHERE id = ?`,
    [userId],
  )
  if (!u) return null

  const roles = await pool.query<Array<{ code: string }>>(
    `SELECT r.code FROM roles r
     JOIN user_roles ur ON ur.role_id = r.id
     WHERE ur.user_id = ?`,
    [userId],
  )
  const perms = await pool.query<Array<{ code: string }>>(
    `SELECT DISTINCT p.code FROM permissions p
     JOIN role_permissions rp ON rp.permission_id = p.id
     JOIN user_roles ur ON ur.role_id = rp.role_id
     WHERE ur.user_id = ?`,
    [userId],
  )

  return {
    id: Number(u.id),
    username: String(u.username),
    email: String(u.email),
    displayName: u.display_name ? String(u.display_name) : null,
    avatarUrl: u.avatar_url ? String(u.avatar_url) : null,
    status: String(u.status),
    isSuperadmin: Boolean(u.is_superadmin),
    mustChangePassword: Boolean(u.must_change_password),
    roles: roles.map((r) => r.code),
    permissions: perms.map((p) => p.code),
  }
}

export async function getAuthUser(userId: number, force = false): Promise<AuthUser | null> {
  const key = `auth:user:${userId}`
  if (!force) {
    const cached = await redis.get(key)
    if (cached) return JSON.parse(cached) as AuthUser
  }
  const user = await loadUserFromDb(userId)
  if (!user) return null
  await redis.set(key, JSON.stringify(user), 'EX', CACHE_TTL)
  return user
}

export async function invalidateAuthUser(userId: number): Promise<void> {
  await redis.del(`auth:user:${userId}`)
}

export async function clearUserCache(): Promise<void> {
  const keys = await redis.keys('auth:user:*')
  if (keys.length) await redis.del(keys)
}
