import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import { testDatabase } from '@vidya/api/shared/datasources'
import { MediaRefusals, Routes } from '@vidya/protocol'
import * as request from 'supertest'
import { DataSource, QueryRunner } from 'typeorm'

import { createStorageContext, refusalFor, StorageContext, TEST_MASTER_KEY } from './context'

const ROUTE = 'PUT /edu/schools/:schoolId/storage'

/**
 * Two people rotating a school's keys at the same moment.
 *
 * Only a real Postgres can hold one writer on the row lock while the other
 * commits: pg-mem has a single session, so under it the two never overlap and
 * the interleaving this asks about cannot be produced at all.
 */
const describeOnPostgres = testDatabase() === 'postgres' ? describe : describe.skip

describeOnPostgres('two rotations of the same school storage at once', () => {
  let app: INestApplication
  let ctx: StorageContext
  let ds: DataSource

  beforeEach(async () => {
    process.env.VIDYA_MEDIA_MASTER_KEY = TEST_MASTER_KEY
    app = await createTestingApp()
    ctx = await createStorageContext(app)
    ds = app.get(DataSource)
  })

  afterEach(async () => {
    await app.close()
  })

  const put = async (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .put(Routes().edu.schools.storage.update(ctx.one.school.id))
      .set('Authorization', await ctx.getAuthTokenFor(ctx.one.users.owner))
      .send(body)

  /** Retires the live profile and inserts a new one, without committing. */
  const startCompetingRotation = async (): Promise<QueryRunner> => {
    const runner = ds.createQueryRunner()
    await runner.connect()
    await runner.startTransaction()

    const [live] = await runner.query(
      'SELECT "id" FROM "storage_profiles" WHERE "schoolId" = $1 AND "retiredAt" IS NULL',
      [ctx.one.school.id],
    )

    await runner.query(
      'UPDATE "storage_profiles" SET "retiredAt" = now(), "updatedAt" = now() ' +
        'WHERE "schoolId" = $1 AND "retiredAt" IS NULL',
      [ctx.one.school.id],
    )

    await runner.query(
      'INSERT INTO "storage_profiles" ' +
        '("id", "schoolId", "provider", "region", "bucket", "prefix", "accessKeyId", ' +
        '"secrets", "delivery", "publicBaseUrl", "endpoint", "r2AccountId") ' +
        'SELECT uuid_generate_v4(), "schoolId", "provider", "region", \'other-bucket\', "prefix", ' +
        '"accessKeyId", "secrets", "delivery", "publicBaseUrl", "endpoint", "r2AccountId" ' +
        'FROM "storage_profiles" WHERE "id" = $1',
      [live.id],
    )

    return runner
  }

  /** Waits until a backend of this database is stuck behind a lock. */
  const waitForABlockedWriter = async (): Promise<void> => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const [{ blocked }] = await ds.query(
        "SELECT count(*)::int AS blocked FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'",
      )
      if (blocked > 0) return

      await new Promise((resolve) => setTimeout(resolve, 25))
    }

    throw new Error('no writer ever blocked on the live-profile row')
  }

  const liveProfiles = async (): Promise<unknown[]> =>
    ds.query('SELECT "id" FROM "storage_profiles" WHERE "schoolId" = $1 AND "retiredAt" IS NULL', [
      ctx.one.school.id,
    ])

  const raceARotation = async () => {
    await put(ctx.credentialsFor(ctx.one.school.id))
    const competitor = await startCompetingRotation()

    const ours = put({ ...ctx.credentialsFor(ctx.one.school.id), bucket: 'vidya-demo-rotated' })
    await waitForABlockedWriter()
    await competitor.commitTransaction()
    await competitor.release()

    return ours
  }

  it('answers the loser with a conflict rather than a server error', async () => {
    const refusal = refusalFor(ROUTE, MediaRefusals.rotationConflicted)

    const response = await raceARotation()

    expect(response.status).toBe(refusal.status)
  })

  it('names the rotation it lost, not the database constraint it hit', async () => {
    const response = await raceARotation()

    expect(response.body.message).toEqual([MediaRefusals.rotationConflicted])
    expect(JSON.stringify(response.body)).not.toContain('UQ_storage_profiles_live_per_school')
  })

  it('leaves the school with exactly one live profile whoever won', async () => {
    await raceARotation()

    await expect(liveProfiles()).resolves.toHaveLength(1)
  })
})
