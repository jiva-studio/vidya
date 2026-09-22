import { createHash } from 'node:crypto'

import { acceptedCredentials, InMemoryStorage } from '@vidya/api/media/infra'
import { testDatabase } from '@vidya/api/shared/datasources'
import { MediaStoragePort } from '@vidya/domain'
import * as protocol from '@vidya/protocol'

import { MediaRowsService } from '../mediaRows.service'
import { createMediaServices, MediaServices } from './mediaContext'

/**
 * What only a real Postgres can prove about deduplication.
 *
 * The index the dedup rests on is partial — one ready row per school and
 * digest — and pg-mem matches an index by its columns without reading its
 * predicate, so under pg-mem a second ready row with the same digest is never
 * rejected and the collision cannot happen at all.
 */
const describeOnPostgres = testDatabase() === 'postgres' ? describe : describe.skip

const BYTES = Buffer.alloc(2048, 0xcd)
const DIGEST = createHash('sha256').update(BYTES).digest('base64')

/**
 * Holds every caller inside the window the dedup index is exposed by.
 *
 * That window is between reading whether the school already holds a digest and
 * writing that it does, and it is a few milliseconds wide. Releasing both
 * completions inside it together is the difference between a test of the race
 * and a test that happens to lose it.
 */
const gatheringAtTheDigestRead = (rows: MediaRowsService, callers: number): void => {
  const read = rows.findReadyByDigest.bind(rows)

  let arrived = 0
  let release: () => void = () => undefined
  const gathered = new Promise<void>((resolve) => {
    release = resolve
  })

  jest.spyOn(rows, 'findReadyByDigest').mockImplementation(async (schoolId, digest) => {
    const found = await read(schoolId, digest)

    arrived += 1
    if (arrived >= callers) release()
    await gathered

    return found
  })
}

describeOnPostgres('completing the same bytes twice at the same time', () => {
  let services: MediaServices
  let storage: MediaStoragePort

  beforeEach(async () => {
    const store = new InMemoryStorage()
    storage = store.openStorage({
      ...acceptedCredentials(),
      endpoint: 'https://de-s3.storage.bunnycdn.com',
      region: 'de',
      bucket: 'vidya-demo',
      prefix: 'school/one',
    })

    services = await createMediaServices({ storage })

    for (const grant of [await ask(), await ask()]) {
      await store.writeByGrant(grant, BYTES)
    }

    gatheringAtTheDigestRead(services.rows, 2)
  })

  afterEach(async () => {
    await services.close()
  })

  const ask = async (): Promise<protocol.CreateUploadResponse['grant']> => {
    const granted = await services.uploads.signUpload(
      {
        schoolId: services.schoolId,
        kind: 'image',
        name: 'lesson-cover.png',
        mimeType: 'image/png',
        sizeBytes: BYTES.length,
        sha256: DIGEST,
      },
      services.userId,
    )

    return granted.grant
  }

  const completeBoth = async (): Promise<PromiseSettledResult<protocol.MediaRecord>[]> => {
    const pending = await services.rows.findAbandoned(new Date(Date.now() + 60_000))

    return Promise.allSettled(pending.map((media) => services.uploads.completeUpload(media)))
  }

  it('answers both askers with the one file the school now holds', async () => {
    const settled = await completeBoth()

    const named = settled.map((result) =>
      result.status === 'fulfilled' ? result.value.id : `refused: ${result.reason}`,
    )

    expect(new Set(named).size).toBe(1)
  })

  it('leaves one row ready and no row waiting for bytes that already landed', async () => {
    await completeBoth()

    const rows = await services.rows.findAbandoned(new Date(Date.now() + 60_000))
    const ready = await services.rows.findReadyByDigest(services.schoolId, DIGEST)

    expect(rows).toEqual([])
    expect(ready).not.toBeNull()
  })

  it('charges the school for one copy and holds no reservation for the other', async () => {
    await completeBoth()

    const usage = await services.usage.readUsage(services.schoolId)

    expect(usage.reservedBytes).toBe(0)
  })

  it('refuses in the vocabulary of the service rather than letting the index speak', async () => {
    const settled = await completeBoth()
    const refusals = settled
      .filter((result) => result.status === 'rejected')
      .map((result) => String((result as PromiseRejectedResult).reason))

    expect(refusals.filter((reason) => /duplicate key|QueryFailedError/.test(reason))).toEqual([])
  })
})
