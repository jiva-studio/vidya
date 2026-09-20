import { ExecutionContext } from '@nestjs/common'
import { ThrottlerException } from '@nestjs/throttler'

import { KeyedThrottlerGuard, ThrottleKey } from '../keyedThrottler.guard'
import { RedisThrottlerStorage } from '../redisThrottlerStorage'

const contextFor = (req: { body?: Record<string, unknown>; ip?: string }): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => req }),
  }) as unknown as ExecutionContext

describe('KeyedThrottlerGuard', () => {
  const build = (keys: ThrottleKey[]) => {
    const storage = { increment: jest.fn() }
    const Guard = KeyedThrottlerGuard(keys)
    return { storage, guard: new Guard(storage as unknown as RedisThrottlerStorage) }
  }

  it('admits a request that stays under every key', async () => {
    const { storage, guard } = build([
      { name: 'login', limit: 5, windowMs: 1000, value: (req) => req.body?.login as string },
    ])
    storage.increment.mockResolvedValue({ totalHits: 1, isBlocked: false })

    await expect(guard.canActivate(contextFor({ body: { login: 'bob' } }))).resolves.toBe(true)
  })

  it('refuses the request the moment any one key is exhausted', async () => {
    const { storage, guard } = build([
      { name: 'login', limit: 5, windowMs: 1000, value: (req) => req.body?.login as string },
      { name: 'ip', limit: 5, windowMs: 1000, value: (req) => req.ip },
    ])
    storage.increment
      .mockResolvedValueOnce({ totalHits: 1, isBlocked: false })
      .mockResolvedValueOnce({ totalHits: 6, isBlocked: true })

    await expect(
      guard.canActivate(contextFor({ body: { login: 'bob' }, ip: '1.2.3.4' })),
    ).rejects.toBeInstanceOf(ThrottlerException)
  })

  it('gives each key its own counter, keyed by its own name', async () => {
    const { storage, guard } = build([
      { name: 'login', limit: 5, windowMs: 1000, value: () => 'bob' },
      { name: 'ip', limit: 5, windowMs: 1000, value: () => 'bob' },
    ])
    storage.increment.mockResolvedValue({ totalHits: 1, isBlocked: false })

    await guard.canActivate(contextFor({}))

    expect(storage.increment).toHaveBeenNthCalledWith(1, 'bob', 1000, 5, 1000, 'login')
    expect(storage.increment).toHaveBeenNthCalledWith(2, 'bob', 1000, 5, 1000, 'ip')
  })

  it('falls back to a shared bucket when the key extractor finds nothing', async () => {
    const { storage, guard } = build([
      { name: 'login', limit: 5, windowMs: 1000, value: (req) => req.body?.login as string },
    ])
    storage.increment.mockResolvedValue({ totalHits: 1, isBlocked: false })

    await guard.canActivate(contextFor({ body: {} }))

    expect(storage.increment).toHaveBeenCalledWith('unknown', 1000, 5, 1000, 'login')
  })
})
