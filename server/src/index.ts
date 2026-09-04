import { createApp } from './app.js'
import { config } from './config.js'
import { connectRedis, pingRedis } from './cache/redis.js'
import { pool, pingDb } from './db/pool.js'
import { runSchema } from './db/pool.js'
import { seed } from './db/seedRunner.js'

async function bootstrap(): Promise<void> {
  await pingDb()
  console.log('[boot] MariaDB connected')

  await connectRedis()
  await pingRedis()
  console.log('[boot] Redis connected')

  // 幂等执行 schema（全部 IF NOT EXISTS）与种子数据
  await runSchema()
  console.log('[boot] schema ready')
  await seed()
  console.log('[boot] seed ready')

  const app = createApp()
  app.listen(config.port, () => {
    console.log(`[clarkgong-server] listening on http://localhost:${config.port} (${config.nodeEnv})`)
  })
}

bootstrap().catch((err) => {
  console.error('[boot] failed:', err)
  process.exit(1)
})

export { pool }
