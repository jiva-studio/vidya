import { randomUUID } from 'node:crypto'

import {
  AbortMultipartUploadCommand,
  CreateMultipartUploadCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3'
import { MediaStoragePort } from '@vidya/domain'

import { StorageCredentials } from '../../infra/ports'
import {
  openStandStorage,
  removeAllUnder,
  standClient,
  standCredentials,
} from '../../infra/specs/stand'
import { createMediaServices, MediaServices } from './mediaContext'

const PART = Buffer.alloc(5 * 1024 * 1024, 7)
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The sweep against a bucket that really holds an unfinished session.
 *
 * The age is moved by the window rather than by waiting: a session cannot be
 * backdated on a provider, so a window of a millisecond is what "older than the
 * window" means here, and the day's window is what "fresher" means.
 */
describe('sweeping unfinished upload sessions on live storage', () => {
  const env = process.env

  let credentials: StorageCredentials
  let storage: MediaStoragePort
  let client: S3Client
  let services: MediaServices
  let key: string
  let uploadId: string

  const sessionsUnder = async (prefix: string): Promise<string[]> => {
    const found: string[] = []
    for await (const session of storage.listUnfinished(prefix)) found.push(session.uploadId)
    return found
  }

  const sweepWithWindow = async (windowMs: number): Promise<void> => {
    process.env.VIDYA_MEDIA_ABANDONED_AFTER_MS = String(windowMs)
    services = await createMediaServices({ storage, prefix: credentials.prefix })
  }

  beforeEach(async () => {
    process.env = { ...env }

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
    // Aborted with the id at hand rather than through the listing this suite is
    // testing: a cleanup that depends on it leaves the session behind exactly
    // when the listing is what is broken.
    await client
      .send(
        new AbortMultipartUploadCommand({
          Bucket: credentials.bucket,
          Key: key,
          UploadId: uploadId,
        }),
      )
      .catch(() => undefined)

    await removeAllUnder(storage, credentials.prefix)
    client.destroy()
    await services.close()
    process.env = env
  })

  it('ends a session that has been open longer than the window', async () => {
    await sweepWithWindow(1)
    await expect(sessionsUnder(credentials.prefix)).resolves.toEqual([uploadId])

    await services.sweep.sweepAbandonedUploads()

    await expect(sessionsUnder(credentials.prefix)).resolves.toEqual([])
  })

  it('leaves a session that may still be uploading its parts', async () => {
    await sweepWithWindow(DAY_MS)
    await expect(sessionsUnder(credentials.prefix)).resolves.toEqual([uploadId])

    await services.sweep.sweepAbandonedUploads()

    await expect(sessionsUnder(credentials.prefix)).resolves.toEqual([uploadId])
  })
})
