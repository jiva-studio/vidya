import { randomUUID } from 'node:crypto'

import { MediaStoragePort } from '@vidya/domain'

import { StorageCredentials } from '../ports'
import {
  openStandStorage,
  readRange,
  removeAllUnder,
  standCredentials,
  writeByGrant,
} from './stand'

const BODY = Buffer.from(Array.from({ length: 4096 }, (_, index) => index % 251))
const TYPE = 'video/mp4'

describe('reading a signed object by range on live storage', () => {
  let credentials: StorageCredentials
  let storage: MediaStoragePort
  let key: string

  beforeEach(async () => {
    credentials = standCredentials(`storage-spec/${randomUUID()}`)
    storage = openStandStorage(credentials)
    key = `${credentials.prefix}/lecture.mp4`

    const grant = await storage.signUpload(key, { contentType: TYPE, sizeBytes: BODY.length })
    const written = await writeByGrant(grant, BODY)

    expect(written.status).toBe(200)
  })

  afterEach(async () => {
    await removeAllUnder(storage, credentials.prefix)
  })

  it('answers a range request with 206 so a player can seek', async () => {
    const signed = await storage.signRead(key, 'video')

    const answer = await readRange(signed.url, 1000, 1999)

    expect(answer.status).toBe(206)
    expect(answer.headers['content-range']).toBe(`bytes 1000-1999/${BODY.length}`)
  })

  it('returns exactly the bytes the range asked for', async () => {
    const signed = await storage.signRead(key, 'video')

    const answer = await readRange(signed.url, 1000, 1999)

    expect(answer.body.length).toBe(1000)
    expect(answer.body.equals(BODY.subarray(1000, 2000))).toBe(true)
  })

  it('answers a range that reaches past the end with what is there', async () => {
    const signed = await storage.signRead(key, 'video')

    const answer = await readRange(signed.url, BODY.length - 10, BODY.length + 500)

    expect(answer.status).toBe(206)
    expect(answer.body.equals(BODY.subarray(BODY.length - 10))).toBe(true)
  })
})
