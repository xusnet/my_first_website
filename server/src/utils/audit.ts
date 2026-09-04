import pool from '../db/pool.js'
import { config } from '../config.js'
import { sha256 } from './crypto.js'

export interface AuditEntry {
  userId?: number | null
  username?: string | null
  action: string
  resource: string
  resourceId?: string | number | null
  ip?: string | null
  userAgent?: string | null
  result?: 'success' | 'failure'
  detail?: unknown
}

const GENESIS = '0'.repeat(64)

/** 串行化审计写入，保证哈希链不被并发打断（单节点部署场景） */
let chainLock: Promise<void> = Promise.resolve()
function withChainLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chainLock.then(fn)
  chainLock = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

function canonicalDetail(detail: unknown): string {
  if (detail === undefined || detail === null) return ''
  if (typeof detail === 'string') return detail
  return JSON.stringify(detail)
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  const detail = canonicalDetail(entry.detail)
  const createdAt = new Date()
  const iso = createdAt.toISOString().slice(0, 19).replace('T', ' ')

  await withChainLock(async () => {
    const [last] = await pool.query<Array<{ log_hash: string }>>(
      'SELECT log_hash FROM audit_logs ORDER BY id DESC LIMIT 1',
    )
    const prevHash = last?.log_hash ?? GENESIS
    const row = [
      prevHash,
      entry.userId ?? '',
      entry.username ?? '',
      entry.action,
      entry.resource,
      entry.resourceId ?? '',
      entry.ip ?? '',
      entry.result ?? 'success',
      detail,
      iso,
    ].join('|')
    const logHash = sha256(`${row}|${config.auditPepper}`)

    await pool.query(
      `INSERT INTO audit_logs
        (user_id, username, action, resource, resource_id, ip, user_agent, result, detail, prev_hash, log_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.userId ?? null,
        entry.username ?? null,
        entry.action,
        entry.resource,
        entry.resourceId != null ? String(entry.resourceId) : null,
        entry.ip ?? null,
        entry.userAgent ?? null,
        entry.result ?? 'success',
        detail || null,
        prevHash,
        logHash,
        createdAt,
      ],
    )
  })
}

export interface ChainNode {
  id: number
  user_id: number | null
  username: string | null
  action: string
  resource: string
  resource_id: string | null
  ip: string | null
  result: string
  detail: string | null
  prev_hash: string
  log_hash: string
  created_at: Date
}

/**
 * 校验审计链完整性：逐行重算 hash，返回断裂位置。
 * 返回 { valid: true } 或 { valid: false, brokenAt: id }
 */
export async function verifyAuditChain(): Promise<{ valid: boolean; brokenAt?: number }> {
  const rows = await pool.query<ChainNode[]>(
    `SELECT id, user_id, username, action, resource, resource_id, ip, result, detail,
            prev_hash, log_hash, created_at
     FROM audit_logs ORDER BY id ASC`,
  )
  let prev = GENESIS
  for (const r of rows) {
    const iso = new Date(r.created_at).toISOString().slice(0, 19).replace('T', ' ')
    const row = [
      prev,
      r.user_id ?? '',
      r.username ?? '',
      r.action,
      r.resource,
      r.resource_id ?? '',
      r.ip ?? '',
      r.result ?? 'success',
      r.detail ?? '',
      iso,
    ].join('|')
    const expected = sha256(`${row}|${config.auditPepper}`)
    if (r.log_hash !== expected || r.prev_hash !== prev) {
      return { valid: false, brokenAt: r.id }
    }
    prev = r.log_hash
  }
  return { valid: true }
}
