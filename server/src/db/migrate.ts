import { pool, runSchema } from './pool.js'

async function migrate(): Promise<void> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_version (
       id INT UNSIGNED NOT NULL AUTO_INCREMENT,
       version INT UNSIGNED NOT NULL,
       applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (id),
       UNIQUE KEY uk_sv_version (version)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  )

  // schema.sql 全部使用 CREATE TABLE IF NOT EXISTS，可安全幂等执行
  await runSchema()

  const [row] = await pool.query<Array<{ v: number }>>(
    'SELECT COALESCE(MAX(version), 0) AS v FROM schema_version',
  )
  const next = (row?.v ?? 0) + 1
  await pool.query('INSERT INTO schema_version (version) VALUES (?)', [next])
  console.log(`[migrate] schema ready (version ${next})`)
}

migrate()
  .then(() => pool.end())
  .catch((err) => {
    console.error('[migrate] failed:', err)
    process.exit(1)
  })
