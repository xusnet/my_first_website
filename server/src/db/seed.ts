import pool from './pool.js'
import { seed } from './seedRunner.js'

seed()
  .then(async () => {
    await pool.end()
  })
  .catch((err) => {
    console.error('[seed] failed:', err)
    process.exit(1)
  })
