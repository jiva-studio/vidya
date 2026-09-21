import { createHash, randomUUID } from 'node:crypto'

import { MediaStoragePort } from '@vidya/domain'

import { StorageCredentials } from '../ports'
import { openStandStorage, removeAllUnder, standCredentials, writeByGrant } from './stand'

const BODY = Buffer.from('the bytes the browser hashed before it asked for a grant', 'utf8')
const OTHER = Buffer.from('the bytes it sent instead, of the very same length......', 'utf8')
const TYPE = 'application/octet-stream'

const sha256Of = (body: Buffer): string => createHash('sha256').update(body).digest('base64')

describe('a write signature that carries a checksum on live storage', () => {
  let credentials: StorageCredentials
  let storage: MediaStoragePort
  let key: string

  beforeEach(() => {
    credentials = standCredentials(`storage-spec/${randomUUID()}`)
    storage = openStandStorage(credentials)
    key = `${credentials.prefix}/hashed`
  })

  afterEach(async () => {
    await removeAllUnder(storage, credentials.prefix)
  })

  it('takes bytes whose hash is the one the grant was signed for', async () => {
    const grant = await storage.signUpload(key, {
      contentType: TYPE,
      sizeBytes: BODY.length,
      sha256: sha256Of(BODY),
    })

    const answer = await writeByGrant(grant, BODY)

    expect(answer.status).toBe(200)
    await expect(storage.head(key)).resolves.toMatchObject({ sizeBytes: BODY.length })
  })

  it('reports the hash it verified when the object is headed', async () => {
    const grant = await storage.signUpload(key, {
      contentType: TYPE,
      sizeBytes: BODY.length,
      sha256: sha256Of(BODY),
    })

    await writeByGrant(grant, BODY)

    await expect(storage.head(key)).resolves.toMatchObject({ sha256: sha256Of(BODY) })
  })

  it('turns away bytes whose hash is not the one the grant was signed for', async () => {
    expect(OTHER.length).toBe(BODY.length)

    const grant = await storage.signUpload(key, {
      contentType: TYPE,
      sizeBytes: BODY.length,
      sha256: sha256Of(BODY),
    })

    const answer = await writeByGrant(grant, OTHER)

    expect(answer.status).toBeGreaterThanOrEqual(400)
    await expect(storage.head(key)).resolves.toBeUndefined()
  })
})
