import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import { TEST_MASTER_KEY } from '@vidya/api/media/controllers/specs/context'
import {
  createMediaFlow,
  MediaFlow,
  runDueJobs,
} from '@vidya/api/media/controllers/specs/uploadFlow'
import { InMemoryStorage } from '@vidya/api/media/infra'
import { testDatabase, testingDataSource } from '@vidya/api/shared/datasources'
import { UploadGrant } from '@vidya/domain'
import { DataSource } from 'typeorm'

/**
 * What only a real Postgres can prove about the sweep.
 *
 * pg-mem has one session and stubs advisory locking out, so under it two
 * instances sweeping at once cannot be told from one, and the property the
 * lock exists for would be untested by construction.
 */
const describeOnPostgres = testDatabase() === 'postgres' ? describe : describe.skip

describeOnPostgres('two instances sweeping abandoned uploads at the same time', () => {
  const HOUR = 60 * 60 * 1000

  let apps: INestApplication[]
  let storage: InMemoryStorage
  let ds: DataSource
  let flow: MediaFlow
  let abandonedKey: string
  let abandonedId: string

  beforeEach(async () => {
    process.env.VIDYA_MEDIA_MASTER_KEY = TEST_MASTER_KEY

    ds = await testingDataSource()
    storage = new InMemoryStorage()
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
    await flow.configureStorage(flow.ctx.one.school.id, flow.ctx.one.users.owner)

    const asked = await flow.askUpload(
      flow.imageUpload(flow.ctx.one.school.id, { sizeBytes: 4096, sha256: undefined }),
      flow.ctx.one.users.owner,
    )
    expect(asked.status).toBe(201)

    const grant = asked.body.grant as UploadGrant
    await flow.putBytes(grant, Buffer.alloc(4096, 4))
    await flow.ageRow(asked.body.mediaId, new Date(Date.now() - 48 * HOUR))

    abandonedId = asked.body.mediaId
    abandonedKey = flow.keyBehind(grant)
  })

  afterEach(async () => {
    for (const app of apps) await app.close()
  })

  it('lets both runs finish without an error', async () => {
    await expect(Promise.all(apps.map((app) => runDueJobs(app)))).resolves.toHaveLength(2)
  })

  it('has the work done once, not twice', async () => {
    await Promise.all(apps.map((app) => runDueJobs(app)))

    expect(flow.removalsOf(abandonedKey)).toBe(1)
    expect(await flow.mediaRow(abandonedId)).toBeUndefined()
  })
})
