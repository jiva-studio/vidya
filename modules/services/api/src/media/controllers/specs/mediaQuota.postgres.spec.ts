import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import { InMemoryStorage } from '@vidya/api/media/infra'
import { testDatabase, testingDataSource } from '@vidya/api/shared/datasources'
import { Routes } from '@vidya/protocol'
import * as request from 'supertest'
import { DataSource } from 'typeorm'

import { TEST_MASTER_KEY } from './context'
import { createMediaFlow, MediaFlow } from './uploadFlow'

/**
 * What only a real database can prove about the quota.
 *
 * More than one instance of the API runs against one database, so a reservation
 * that holds only inside a process holds nothing: under pg-mem the two
 * instances share a single session and a lock taken in one is a lock the other
 * already has, which makes an overrun between them impossible to stage.
 */
const describeOnPostgres = testDatabase() === 'postgres' ? describe : describe.skip

const QUOTA_BYTES = 20480
const FILE_BYTES = 4096

describeOnPostgres('two instances signing uploads against one quota', () => {
  let apps: INestApplication[]
  let ds: DataSource
  let flow: MediaFlow
  let token: string

  beforeEach(async () => {
    process.env.VIDYA_MEDIA_MASTER_KEY = TEST_MASTER_KEY

    ds = await testingDataSource()
    const storage = new InMemoryStorage()
    apps = []

    for (let instance = 0; instance < 2; instance += 1) {
      apps.push(
        await createTestingApp([
          { provide: DataSource, useValue: ds },
          { provide: InMemoryStorage, useValue: storage },
        ]),
      )
    }

    flow = await createMediaFlow(apps[0])
    await flow.configureStorage(flow.ctx.one.school.id, flow.ctx.one.users.owner, {
      quotaBytes: QUOTA_BYTES,
    })

    token = await flow.ctx.getAuthTokenFor(flow.ctx.one.users.owner)
  })

  afterEach(async () => {
    for (const app of apps) await app.close()
  })

  const askOn = async (app: INestApplication) =>
    request(app.getHttpServer())
      .post(Routes().media.uploads())
      .set('Authorization', token)
      .send(flow.imageUpload(flow.ctx.one.school.id, { sizeBytes: FILE_BYTES, sha256: undefined }))

  const askAllAtOnce = async (): Promise<number[]> => {
    const asked = await Promise.all(
      Array.from({ length: 10 }, (_ignored, attempt) => askOn(apps[attempt % apps.length])),
    )

    return asked.map((response) => response.status)
  }

  it('grants room to five of ten asks that arrive on both instances together', async () => {
    const statuses = await askAllAtOnce()

    expect(statuses.filter((status) => status === 201)).toHaveLength(QUOTA_BYTES / FILE_BYTES)
  })

  it('never promises more bytes than the quota holds, whichever instance is asked', async () => {
    await askAllAtOnce()

    const usage = await flow.usageOf(flow.ctx.one.school.id, flow.ctx.one.users.owner)

    expect(usage.body.reservedBytes).toBeLessThanOrEqual(QUOTA_BYTES)
  })
})
