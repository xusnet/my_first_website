import { Redis } from 'ioredis'
import { config } from '../config.js'

export const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
  lazyConnect: true,
  maxRetriesPerRequest: 3,
})

export async function connectRedis(): Promise<void> {
  redis.on('error', (err: Error) => {
    console.error('[redis] error:', err.message)
  })
  await redis.connect()
}

export async function pingRedis(): Promise<void> {
  await redis.ping()
}

export default redis
