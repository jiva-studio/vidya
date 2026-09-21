import { randomUUID } from 'node:crypto'

import { MediaStoragePort } from '@vidya/domain'

import { StorageCredentials } from '../ports'
import {
  openStandStorage,
  removeAllUnder,
  standCredentials,
  writeByGrant,
  writeLyingAboutLength,
} from './stand'

const BODY = Buffer.from('a stored lesson illustration, as bytes', 'utf8')
const TYPE = 'image/png'

describe('what a write signature binds on live storage', () => {
  let credentials: StorageCredentials
  let storage: MediaStoragePort
  let key: string

  beforeEach(() => {
    credentials = standCredentials(`storage-spec/${randomUUID()}`)
    storage = openStandStorage(credentials)
    key = `${credentials.prefix}/upload`
  })

  afterEach(async () => {
    await removeAllUnder(storage, credentials.prefix)
  })

  it('takes a body of exactly the size and type the grant declared', async () => {
    const grant = await storage.signUpload(key, { contentType: TYPE, sizeBytes: BODY.length })

    const answer = await writeByGrant(grant, BODY)

    expect(answer.status).toBe(200)
    await expect(storage.head(key)).resolves.toMatchObject({
      sizeBytes: BODY.length,
      contentType: TYPE,
    })
  })

  it('turns away a body longer than the grant declared', async () => {
    const grant = await storage.signUpload(key, { contentType: TYPE, sizeBytes: BODY.length })

    const answer = await writeByGrant(grant, Buffer.concat([BODY, Buffer.from('extra')]))

    expect(answer.status).toBeGreaterThanOrEqual(400)
    await expect(storage.head(key)).resolves.toBeUndefined()
  })

  it('turns away a body shorter than the grant declared', async () => {
    const grant = await storage.signUpload(key, { contentType: TYPE, sizeBytes: BODY.length })

    const answer = await writeByGrant(grant, BODY.subarray(0, BODY.length - 1))

    expect(answer.status).toBeGreaterThanOrEqual(400)
    await expect(storage.head(key)).resolves.toBeUndefined()
  })

  it('turns away a body sent under a content type the grant did not declare', async () => {
    const grant = await storage.signUpload(key, { contentType: TYPE, sizeBytes: BODY.length })

    const answer = await writeByGrant(grant, BODY, { 'Content-Type': 'image/jpeg' })

    expect(answer.status).toBeGreaterThanOrEqual(400)
    await expect(storage.head(key)).resolves.toBeUndefined()
  })

  it('stores no more than the declared length when the body runs past it', async () => {
    const grant = await storage.signUpload(key, { contentType: TYPE, sizeBytes: BODY.length })
    const longer = Buffer.concat([BODY, Buffer.from('and a tail nobody signed for')])

    const answer = await writeLyingAboutLength(grant, BODY.length, longer)
    const stored = await storage.head(key)

    expect(answer.status).toBeLessThan(500)
    expect(stored?.sizeBytes ?? 0).not.toBe(longer.length)
    if (stored) expect(stored.sizeBytes).toBe(BODY.length)
  })
})
