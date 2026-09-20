import { RedisService } from '@vidya/api/shared/services'

import { RedisThrottlerStorage } from '../redisThrottlerStorage'

/** Mirrors real INCR/EXPIRE semantics: creates the key at 1, arms the TTL once. */
class FakeRedis {
  readonly store = new Map<string, number>()
  readonly ttls = new Map<string, number>()

  async incr(key: string, seconds: number): Promise<number> {
    const value = (this.store.get(key) ?? 0) + 1
    this.store.set(key, value)
    if (value === 1) this.ttls.set(key, seconds)
    return value
  }
}

const build = () => {
  const redis = new FakeRedis()
  return { redis, storage: new RedisThrottlerStorage(redis as unknown as RedisService) }
}

describe('RedisThrottlerStorage', () => {
  it('admits requests up to the limit', async () => {
    const { storage } = build()

    for (let i = 1; i <= 3; i++) {
      const record = await storage.increment('bob', 1000, 3, 1000, 'test')
      expect(record.totalHits).toBe(i)
      expect(record.isBlocked).toBe(false)
    }
  })

  it('blocks the request that exceeds the limit', async () => {
    const { storage } = build()

    for (let i = 0; i < 3; i++) {
      await storage.increment('bob', 1000, 3, 1000, 'test')
    }
    const fourth = await storage.increment('bob', 1000, 3, 1000, 'test')

    expect(fourth.totalHits).toBe(4)
    expect(fourth.isBlocked).toBe(true)
  })

  it('keeps two different keys in independent buckets', async () => {
    const { storage } = build()

    await storage.increment('bob', 1000, 1, 1000, 'test')
    const alice = await storage.increment('alice', 1000, 1, 1000, 'test')

    expect(alice.totalHits).toBe(1)
    expect(alice.isBlocked).toBe(false)
  })

  it('keeps two different throttler names in independent buckets for the same key', async () => {
    const { storage } = build()

    await storage.increment('bob', 1000, 1, 1000, 'login')
    const byIp = await storage.increment('bob', 1000, 1, 1000, 'ip')

    expect(byIp.totalHits).toBe(1)
    expect(byIp.isBlocked).toBe(false)
  })

  it('arms Redis with the window converted to whole seconds', async () => {
    const { redis, storage } = build()

    await storage.increment('bob', 90_000, 5, 90_000, 'test')

    expect([...redis.ttls.values()]).toEqual([90])
  })
})
