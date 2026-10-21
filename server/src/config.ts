import 'dotenv/config'

const nodeEnv = process.env.NODE_ENV ?? 'development'
const isProd = nodeEnv === 'production'

function bool(v: string | undefined, d = false): boolean {
  if (v === undefined) return d
  return v === 'true' || v === '1'
}

function num(v: string | undefined, d: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : d
}

/**
 * 读取必填的敏感配置（密钥、口令、pepper）。
 *
 * 生产环境（NODE_ENV=production）缺失或为空时直接抛错拒绝启动，
 * 避免部署时漏配环境变量而静默使用弱默认值。
 * 开发/测试环境回退到占位值，仅为便于本地起服务，不具备任何安全性。
 */
function secret(name: string, devFallback: string): string {
  const v = process.env[name]
  if (v !== undefined && v.trim() !== '') return v
  if (isProd) {
    throw new Error(
      `[config] 生产环境缺少必需的环境变量 ${name}。` +
        '请在部署环境中显式设置，不允许回退到默认值。',
    )
  }
  return devFallback
}

export const config = {
  nodeEnv,
  port: num(process.env.PORT, 3001),
  isProd,

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
    accessSecret: secret('JWT_ACCESS_SECRET', 'dev-only-access-secret-change-me'),
    refreshSecret: secret('JWT_REFRESH_SECRET', 'dev-only-refresh-secret-change-me'),
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },

  auditPepper: secret('AUDIT_PEPPER', 'dev-only-audit-pepper-change-me'),

  admin: {
    username: process.env.ADMIN_USERNAME ?? 'admin',
    initialPassword: secret('ADMIN_INITIAL_PASSWORD', 'DevOnly-ChangeMe-0000!'),
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