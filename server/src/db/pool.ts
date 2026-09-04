import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mariadb from 'mariadb'
import { config } from '../config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const pool = mariadb.createPool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  connectionLimit: 10,
  collation: 'utf8mb4_unicode_ci',
  supportBigNumbers: true,
  bigNumberStrings: false,
  dateStrings: false,
  insertIdAsNumber: true,
  decimalAsNumber: true,
  namedPlaceholders: true,
  trace: false,
})

export async function pingDb(): Promise<void> {
  const conn = await pool.getConnection()
  try {
    await conn.query('SELECT 1')
  } finally {
    conn.release()
  }
}

export async function runSchema(): Promise<void> {
  const schemaPath = path.join(__dirname, 'schema.sql')
  const sql = fs.readFileSync(schemaPath, 'utf8')
  const conn = await pool.getConnection()
  try {
    const withoutComments = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
    const statements = withoutComments
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
    for (const stmt of statements) {
      await conn.query(stmt)
    }
  } finally {
    conn.release()
  }
}

export default pool
