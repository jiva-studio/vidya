import { INestApplication } from '@nestjs/common'
import { throttlerSettings } from '@vidya/api/configs'
import { createTestingApp } from '@vidya/api/edu/shared'
import { RedisService } from '@vidya/api/shared/services'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'

import { createSyncContext, SyncContext } from './context'

/** Real INCR/EXPIRE semantics, so the throttle actually counts across calls. */
class CountingRedis {
  private readonly counters = new Map<string, number>()

  async get(): Promise<string | null> {
    return null
  }

  async set(): Promise<void> {}

  async exists(): Promise<boolean> {
    return false
  }

  async del(): Promise<void> {}

  async incr(key: string): Promise<number> {
    const value = (this.counters.get(key) ?? 0) + 1
    this.counters.set(key, value)
    return value
  }
}

describe('rate limiting on /sync/push', () => {
  let app: INestApplication
  let ctx: SyncContext

  beforeEach(async () => {
    app = await createTestingApp([{ provide: RedisService, useValue: new CountingRedis() }])
    ctx = await createSyncContext(app)
  })

  afterEach(async () => {
    await app.close()
  })

  it('gives sync its own, more generous allowance than the global default', async () => {
    // More than the global default (100/min) admits on its own, but well under
    // sync's own allowance — proving this controller is not left to the
    // default that every other route shares.
    const calls = throttlerSettings().default.limit + 10

    for (let i = 0; i < calls; i++) {
      await request(app.getHttpServer())
        .post(protocol.Routes().sync.push())
        .auth(ctx.tokens.student, { type: 'bearer' })
        .send({ deviceId: 'device-throttling', changes: [] })
        .expect(200)
    }
  })
})
