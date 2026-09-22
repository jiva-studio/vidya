import { randomUUID } from 'node:crypto'

import {
  AbortMultipartUploadCommand,
  CreateMultipartUploadCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3'
import { MediaStoragePort } from '@vidya/domain'

import { StorageCredentials } from '../ports'
import { openStandStorage, removeAllUnder, standClient, standCredentials } from './stand'

const PART = Buffer.alloc(5 * 1024 * 1024, 7)

describe('upload sessions begun and never finished on live storage', () => {
  let credentials: StorageCredentials
  let storage: MediaStoragePort
  let client: S3Client
  let key: string
  let uploadId: string

  const sessionsUnder = async (prefix: string) => {
    const found: { key: string; uploadId: string; startedAt: Date }[] = []
    for await (const session of storage.listUnfinished(prefix)) found.push(session)
    return found
  }

  const keysUnder = async (prefix: string) => {
    const found: string[] = []
    for await (const object of storage.listPrefix(prefix)) found.push(object.key)
    return found
  }

  beforeEach(async () => {
    credentials = standCredentials(`storage-spec/${randomUUID()}`)
    storage = openStandStorage(credentials)
    client = standClient(credentials)
    key = `${credentials.prefix}/unfinished.mp4`

    const begun = await client.send(
      new CreateMultipartUploadCommand({
        Bucket: credentials.bucket,
        Key: key,
        ContentType: 'video/mp4',
      }),
    )

    uploadId = begun.UploadId ?? ''

    await client.send(
      new UploadPartCommand({
        Bucket: credentials.bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: 1,
        Body: PART,
      }),
    )
  })

  afterEach(async () => {
    // Aborted through the client with the id at hand, not through the port: a
    // suite whose cleanup depends on the listing it is testing leaves the
    // session behind exactly when the listing is what is broken.
    const abort = new AbortMultipartUploadCommand({
      Bucket: credentials.bucket,
      Key: key,
      UploadId: uploadId,
    })

    // An already aborted session answers NoSuchUpload, which is the state the
    // cleanup wanted.
    await client.send(abort).catch(() => undefined)

    await removeAllUnder(storage, credentials.prefix)
    client.destroy()
  })

  it('names the session, its key and when it began', async () => {
    const found = await sessionsUnder(credentials.prefix)

    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ key, uploadId })
    expect(found[0].startedAt.getTime()).toBeGreaterThan(Date.now() - 600_000)
  })

  it('leaves the session invisible to a listing of the prefix', async () => {
    await expect(keysUnder(credentials.prefix)).resolves.toEqual([])
    await expect(storage.head(key)).resolves.toBeUndefined()
  })

  it('stops listing the session once it has been aborted', async () => {
    await storage.abortUnfinished(key, uploadId)

    await expect(sessionsUnder(credentials.prefix)).resolves.toEqual([])
  })
})
