import 'dotenv/config'

function bool(v: string | undefined, d = false): boolean {
  if (v === undefined) return d
  return v === 'true' || v === '1'
}

function num(v: string | undefined, d: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : d
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: num(process.env.PORT, 3001),
  isProd: (process.env.NODE_ENV ?? 'development') === 'production',

  db: {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: num(process.env.DB_PORT, 3306),
    database: process.env.DB_NAME ?? 'clarkgong',
    user: process.env.DB_USER ?? 'clarkgong',
    password: process.env.DB_PASSWORD ?? '',
  },

  redis: {
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: num(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD ?? '',
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },

  auditPepper: process.env.AUDIT_PEPPER ?? 'dev-audit-pepper',

  admin: {
    username: process.env.ADMIN_USERNAME ?? 'admin',
    initialPassword: process.env.ADMIN_INITIAL_PASSWORD ?? '***REMOVED-BY-HISTORY-REWRITE***',
  },

  password: {
    minLength: num(process.env.PASSWORD_MIN_LENGTH, 12),
    requireUpper: bool(process.env.PASSWORD_REQUIRE_UPPERCASE, true),
    requireLower: bool(process.env.PASSWORD_REQUIRE_LOWERCASE, true),
    requireDigit: bool(process.env.PASSWORD_REQUIRE_DIGIT, true),
    requireSpecial: bool(process.env.PASSWORD_REQUIRE_SPECIAL, true),
    history: num(process.env.PASSWORD_HISTORY, 5),
    maxAgeDays: num(process.env.PASSWORD_MAX_AGE_DAYS, 90),
  },

  login: {
    maxAttempts: num(process.env.LOGIN_MAX_ATTEMPTS, 5),
    lockMinutes: num(process.env.LOGIN_LOCK_MINUTES, 15),
  },

  rateLimit: {
    globalPerMin: num(process.env.RATE_LIMIT_GLOBAL_PER_MIN, 300),
    authPerMin: num(process.env.RATE_LIMIT_AUTH_PER_MIN, 10),
  },
} as const

export type Config = typeof config
