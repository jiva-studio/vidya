import { createHash, randomUUID } from 'node:crypto'

import { MediaStoragePort } from '@vidya/domain'

import { StorageCredentials } from '../../infra/ports'
import {
  openStandStorage,
  removeAllUnder,
  standCredentials,
  writeByGrant,
} from '../../infra/specs/stand'
import { createMediaServices, MediaServices } from './mediaContext'

const MINE = Buffer.alloc(2048, 0xaa)
const THEIRS = Buffer.alloc(2048, 0xbb)

const digestOf = (body: Buffer): string => createHash('sha256').update(body).digest('base64')

describe('the digest a completion records against live storage', () => {
  let credentials: StorageCredentials
  let storage: MediaStoragePort
  let services: MediaServices

  beforeEach(async () => {
    credentials = standCredentials(`storage-spec/${randomUUID()}`)
    storage = openStandStorage(credentials)
    services = await createMediaServices({ storage, prefix: credentials.prefix })
  })

  afterEach(async () => {
    await removeAllUnder(storage, credentials.prefix)
    await services.close()
  })

  const upload = async (body: Buffer, sha256?: string): Promise<string> => {
    const granted = await services.uploads.signUpload(
      {
        schoolId: services.schoolId,
        kind: 'image',
        name: 'lesson-cover.png',
        mimeType: 'image/png',
        sizeBytes: body.length,
        sha256,
      },
      services.userId,
    )

    expect((await writeByGrant(granted.grant, body)).status).toBe(200)

    return granted.mediaId
  }

  const complete = async (mediaId: string, declared: string) => {
    const media = await services.rows.findById(mediaId as never)
    expect(media).not.toBeNull()

    return services.uploads.completeUpload(media!, declared)
  }

  it('leaves the row without one when the provider was never given a checksum', async () => {
    const mediaId = await upload(MINE)

    await complete(mediaId, digestOf(MINE))

    expect((await services.rows.findById(mediaId as never))?.sha256).toBeNull()
  })

  it('answers an upload with its own file, not one an earlier row laid claim to', async () => {
    const claiming = await upload(MINE)
    await complete(claiming, digestOf(THEIRS))

    const honest = await upload(THEIRS, digestOf(THEIRS))
    const record = await complete(honest, digestOf(THEIRS))

    expect(record.id).toBe(honest)
  })

  it('leaves the bytes of that upload in the bucket instead of dropping them as a copy', async () => {
    const claiming = await upload(MINE)
    await complete(claiming, digestOf(THEIRS))

    const honest = await upload(THEIRS, digestOf(THEIRS))
    const key = (await services.rows.findById(honest as never))?.storageKey ?? ''
    await complete(honest, digestOf(THEIRS))

    await expect(storage.head(key)).resolves.toMatchObject({ sizeBytes: THEIRS.length })
  })
})
